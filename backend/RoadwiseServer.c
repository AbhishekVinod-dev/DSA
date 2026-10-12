/*
 * ============================================================================
 *  Roadwise Backend in C - Smart Traffic Violation Prevention & Management
 *  (PRD v1.0). Direct C port of RoadwiseServer.java / Roadwise server.py.
 *
 *  Features:
 *   - Native HTTP/1.1 server on a TCP socket (no framework; BSD-style sockets)
 *   - SQLite database integration (traffic.db) via the SQLite amalgamation
 *   - PBKDF2-HMAC-SHA256 password hashing (embedded SHA-256, no OpenSSL)
 *   - Deterministic explainable risk engine
 *     (Frequency 30% / Recent 25% / Repeat 25% / Severity 20%)
 *   - Hotspot detection (1.25x average threshold) & temporal analytics
 *   - Rule-based pattern detection & automated alert engine
 *   - Smart Alert Prioritization (binary Heap + Comparator): every alert is
 *     scored 0-100 from severity, driver risk and urgency, pushed onto a
 *     max-heap, then drained so the most important alert is served first
 *   - What-If scenario impact simulations
 *   - Automated demo database seeder (150 drivers, 150 vehicles, synthetic
 *     violations) with a deterministic PRNG
 *   - Plain text & CSV audit reporting
 *
 *  Build (from the backend/ directory on Windows/MinGW):
 *     gcc -O2 -std=c99 RoadwiseServer.c sqlite/sqlite3.c -o RoadwiseServer.exe -lws2_32 -lm
 *
 *  Run:
 *     RoadwiseServer.exe           (uses traffic.db in the current directory)
 *     set PORT=8000 && RoadwiseServer.exe
 *
 *  Demo Logins:
 *     admin   / admin123
 *     officer / officer123
 *
 *  API (mirrors the Java version):
 *     GET  /api/public              -> public aggregate stats
 *     POST /api/login               -> {username,password} -> {token,user}
 *     GET  /api/analytics           -> full analytics object (Bearer auth)
 *     GET  /api/drivers?q=          -> ranked driver search
 *     GET  /api/drivers/<id>        -> driver detail + history + risk + alerts
 *     POST /api/violations          -> record a violation, recalc risk/alerts
 *     GET  /api/alerts              -> PRIORITIZED alerts (PriorityQueue/Heap)
 *     POST /api/alerts/<id>/ack     -> mark an alert Reviewed
 *     GET  /api/whatif?scenario=&location=  -> what-if estimate
 *     GET  /api/report?kind=&id=    -> text/CSV reports
 * ============================================================================
 */
#define _CRT_SECURE_NO_WARNINGS
#define WIN32_LEAN_AND_MEAN

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <process.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <ctype.h>
#include <math.h>
#include <time.h>
#include "sqlite/sqlite3.h"

#pragma comment(lib, "ws2_32.lib")

/* ============================================================================
 * CONFIGURATION & CONSTANTS
 * ==========================================================================*/

#define DB_PATH          "traffic.db"
#define REPEAT_N         3
#define WINDOW_N         30          /* days                          */
#define HOTSPOT_FACTOR   1.25
#define PBKDF2_ITER      100000
#define MAX_SESSIONS     256
#define PORT_DEFAULT     8000
#define PAGE_MAX         65536

static const char *G_FIRST[] = {
    "Arun","Bala","Chitra","Deepa","Elango","Farook","Gowri","Hari","Indu","Jothi",
    "Karthik","Lakshmi","Madhan","Nithya","Om","Priya","Ravi","Selvi","Tamil","Uma",
    "Vijay","Yamini"
};
#define G_FIRST_N (int)(sizeof(G_FIRST)/sizeof(G_FIRST[0]))

static const char *G_LAST[] = {
    "Kumar","Raj","Devi","Pandian","Nair","Iyer","Murugan","Sekar","Rao","Babu",
    "Selvam","Krishnan"
};
#define G_LAST_N (int)(sizeof(G_LAST)/sizeof(G_LAST[0]))

typedef struct {
    const char *type;
    const char *severity;
    int         fine;
} ViolationRule;

static ViolationRule G_TYPES[] = {
    {"Overspeeding",      "Major",  1000},
    {"Red Light Jumping", "Severe", 1500},
    {"No Helmet",         "Medium", 500},
    {"No Seatbelt",       "Minor",  500},
    {"Illegal Parking",   "Minor",  300},
    {"Mobile Phone Use",  "Medium", 1000},
    {"Wrong Side Driving","Major",  1000},
    {"Drunk Driving",     "Severe", 5000},
};
#define G_TYPES_N (int)(sizeof(G_TYPES)/sizeof(G_TYPES[0]))

/* Severity -> weight. */
static int sev_weight(const char *sev) {
    if (strcmp(sev, "Minor")   == 0) return 25;
    if (strcmp(sev, "Medium")  == 0) return 50;
    if (strcmp(sev, "Major")   == 0) return 75;
    if (strcmp(sev, "Severe")  == 0) return 100;
    return 25;
}

/* Alert severity -> weight used by Smart Alert Prioritization. */
static int alert_sev_weight(const char *sev) {
    if (sev == NULL) return 25;
    if (strcmp(sev, "Info")     == 0) return 10;
    if (strcmp(sev, "Low")      == 0) return 25;
    if (strcmp(sev, "Medium")   == 0) return 50;
    if (strcmp(sev, "High")     == 0) return 75;
    if (strcmp(sev, "Critical") == 0) return 100;
    return 25;
}

static const char *G_LOCS[] = {
    "Anna Nagar","T. Nagar","Adyar","Velachery","Guindy",
    "Tambaram","Srivilliputhur Bypass","Madurai Periyar","Rajapalayam Road","Sivakasi Junction"
};
#define G_LOCS_N (int)(sizeof(G_LOCS)/sizeof(G_LOCS[0]))

static const char *G_SCEN_N[] = {
    "Additional monitoring", "Signage and road markings", "Focused enforcement drive"
};
static int G_SCEN_LO[] = { 7, 5, 10 };
static int G_SCEN_HI[] = { 14, 10, 18 };

static const char *G_VTYPE[] = {
    "Motorcycle","Car","Scooter","Truck"
};
#define G_VTYPE_N (int)(sizeof(G_VTYPE)/sizeof(G_VTYPE[0]))

static const char *G_VMODEL[][2] = {
    {"Motorcycle","Splendor"},{"Motorcycle","Pulsar"},
    {"Car","Swift"},{"Car","i20"},
    {"Scooter","Activa"},{"Truck","Tata 407"}
};
#define G_VMODEL_N (int)(sizeof(G_VMODEL)/sizeof(G_VMODEL[0]))

/* ============================================================================
 * UTILITIES
 * ==========================================================================*/

static char *xstrdup(const char *s) {
    size_t n = strlen(s) + 1;
    char *p = (char *)malloc(n);
    if (p) memcpy(p, s, n);
    return p;
}

static char *xstrndup(const char *s, size_t n) {
    char *p = (char *)malloc(n + 1);
    if (p) { memcpy(p, s, n); p[n] = 0; }
    return p;
}

static long roundi(double x) { return (long)floor(x + 0.5); }

static void now_str(char *out, size_t sz) {
    time_t t = time(NULL);
    struct tm tm = *localtime(&t);
    strftime(out, sz, "%Y-%m-%d %H:%M", &tm);
}

static void today_str(char *out, size_t sz) {
    time_t t = time(NULL);
    struct tm tm = *localtime(&t);
    strftime(out, sz, "%Y-%m-%d", &tm);
}

static void minus_days_str(char *out, size_t sz, int days) {
    time_t t = time(NULL);
    struct tm tm = *localtime(&t);
    tm.tm_mday -= days;
    mktime(&tm);
    strftime(out, sz, "%Y-%m-%d", &tm);
}

/* Days between two "yyyy-mm-dd" dates (b - a). */
static long days_between(const char *a, const char *b) {
    struct tm ta, tb;
    memset(&ta, 0, sizeof(ta));
    memset(&tb, 0, sizeof(tb));
    if (sscanf(a, "%d-%d-%d", &ta.tm_year, &ta.tm_mon, &ta.tm_mday) != 3) return 0;
    if (sscanf(b, "%d-%d-%d", &tb.tm_year, &tb.tm_mon, &tb.tm_mday) != 3) return 0;
    ta.tm_year -= 1900; ta.tm_mon -= 1;
    tb.tm_year -= 1900; tb.tm_mon -= 1;
    time_t ta_t = mktime(&ta), tb_t = mktime(&tb);
    return (long)((tb_t - ta_t) / 86400);
}

/* Days between a "yyyy-mm-dd HH:mm" timestamp and now (>= 0). */
static long days_open_since(const char *created_at) {
    struct tm tc;
    memset(&tc, 0, sizeof(tc));
    int y, mo, d, h, mi;
    if (sscanf(created_at, "%d-%d-%d %d:%d", &y, &mo, &d, &h, &mi) != 5) return 0;
    tc.tm_year = y - 1900; tc.tm_mon = mo - 1; tc.tm_mday = d;
    tc.tm_hour = h; tc.tm_min = mi; tc.tm_sec = 0;
    time_t created = mktime(&tc);
    time_t now = time(NULL);
    double diff = difftime(now, created) / 86400.0;
    return diff < 0 ? 0 : (long)diff;
}

static const char *level_str(int score) {
    if (score <= 30) return "Low";
    if (score <= 60) return "Medium";
    if (score <= 80) return "High";
    return "Critical";
}

static const char *period_str(int hour) {
    if (hour >= 5  && hour < 12) return "Morning";
    if (hour >= 12 && hour < 17) return "Afternoon";
    if (hour >= 17 && hour < 21) return "Evening";
    return "Night";
}

/* ============================================================================
 * PRNG (deterministic, mulberry32) - used by the demo seeder
 * ==========================================================================*/

typedef struct { uint32_t a; } Rng;

static void rng_seed(Rng *r, uint32_t s)   { r->a = s; }
static double rng_next(Rng *r) {
    r->a += 0x6D2B79F5u;
    uint32_t t = r->a;
    t = (uint32_t)((t ^ (t >> 15)) * (t | 1u));
    t ^= (t + ((t ^ (t >> 7)) * (t | 61u)));
    return ((t ^ (t >> 14)) >> 0) / 4294967296.0;
}
static int rng_int(Rng *r, int n)   { return (int)(rng_next(r) * n); }
static double rng_double(Rng *r)    { return rng_next(r); }

static double triangular(Rng *r, double low, double high, double mode) {
    double u = rng_double(r);
    double c = (mode - low) / (high - low);
    if (u <= c) return low + sqrt(u * (high - low) * (mode - low));
    return high - sqrt((1.0 - u) * (high - low) * (high - mode));
}

/* ============================================================================
 * SHA-256 / HMAC-SHA256 / PBKDF2 (embedded, no OpenSSL dependency)
 * ==========================================================================*/

typedef struct {
    uint32_t state[8];
    uint64_t count;
    uint8_t  buffer[64];
} SHA256_CTX;

static const uint32_t SHA256_K[64] = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
};

#define RR(x,n) (((x) >> (n)) | ((x) << (32 - (n))))

static void sha256_transform(SHA256_CTX *ctx, const uint8_t *data) {
    uint32_t w[64], a, b, c, d, e, f, g, h, t1, t2;
    int i;
    for (i = 0; i < 16; i++) {
        w[i] = ((uint32_t)data[i*4] << 24) | ((uint32_t)data[i*4+1] << 16) |
               ((uint32_t)data[i*4+2] << 8) | (uint32_t)data[i*4+3];
    }
    for (i = 16; i < 64; i++) {
        uint32_t s0 = RR(w[i-15], 7) ^ RR(w[i-15], 18) ^ (w[i-15] >> 3);
        uint32_t s1 = RR(w[i-2], 17) ^ RR(w[i-2], 19) ^ (w[i-2] >> 10);
        w[i] = w[i-16] + s0 + w[i-7] + s1;
    }
    a = ctx->state[0]; b = ctx->state[1]; c = ctx->state[2]; d = ctx->state[3];
    e = ctx->state[4]; f = ctx->state[5]; g = ctx->state[6]; h = ctx->state[7];
    for (i = 0; i < 64; i++) {
        uint32_t S1 = RR(e, 6) ^ RR(e, 11) ^ RR(e, 25);
        uint32_t ch = (e & f) ^ ((~e) & g);
        uint32_t S0 = RR(a, 2) ^ RR(a, 13) ^ RR(a, 22);
        uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
        t1 = h + S1 + ch + SHA256_K[i] + w[i];
        t2 = S0 + maj;
        h = g; g = f; f = e; e = d + t1;
        d = c; c = b; b = a; a = t1 + t2;
    }
    ctx->state[0]+=a; ctx->state[1]+=b; ctx->state[2]+=c; ctx->state[3]+=d;
    ctx->state[4]+=e; ctx->state[5]+=f; ctx->state[6]+=g; ctx->state[7]+=h;
}

static void sha256_init(SHA256_CTX *ctx) {
    ctx->state[0]=0x6a09e667; ctx->state[1]=0xbb67ae85;
    ctx->state[2]=0x3c6ef372; ctx->state[3]=0xa54ff53a;
    ctx->state[4]=0x510e527f; ctx->state[5]=0x9b05688c;
    ctx->state[6]=0x1f83d9ab; ctx->state[7]=0x5be0cd19;
    ctx->count = 0;
    memset(ctx->buffer, 0, sizeof(ctx->buffer));
}

static void sha256_update(SHA256_CTX *ctx, const uint8_t *data, size_t len) {
    size_t i, have, need;
    have = (size_t)((ctx->count / 8) % 64);
    ctx->count += (uint64_t)len * 8;
    need = 64 - have;
    if (len >= need) {
        if (have) {
            memcpy(ctx->buffer + have, data, need);
            sha256_transform(ctx, ctx->buffer);
            data += need; len -= need; have = 0;
        }
        while (len >= 64) {
            sha256_transform(ctx, data);
            data += 64; len -= 64;
        }
    }
    if (have) memcpy(ctx->buffer + have, data, len);
    else if (len) memcpy(ctx->buffer, data, len);
}

static void sha256_final(SHA256_CTX *ctx, uint8_t digest[32]) {
    uint8_t bitlen[8];
    size_t have, padlen, i;
    static const uint8_t PAD[64] = { 0x80 };
    for (i = 0; i < 8; i++) bitlen[i] = (uint8_t)((ctx->count >> ((7 - (int)i) * 8)) & 0xff);
    have = (size_t)((ctx->count / 8) % 64);
    padlen = (have < 56) ? (56 - have) : (120 - have);
    sha256_update(ctx, PAD, padlen);
    sha256_update(ctx, bitlen, 8);
    for (i = 0; i < 8; i++) {
        digest[i]   = (uint8_t)(ctx->state[i] >> 24);
        digest[i+8] = (uint8_t)(ctx->state[i] >> 16);
        digest[i+16]= (uint8_t)(ctx->state[i] >> 8);
        digest[i+24]= (uint8_t)ctx->state[i];
    }
}

static void hmac_sha256(const uint8_t *key, size_t klen,
                        const uint8_t *msg, size_t mlen, uint8_t out[32]) {
    uint8_t k0[64], inner[64], outer[64];
    SHA256_CTX ctx;
    size_t i;
    memset(k0, 0, sizeof(k0));
    if (klen > 64) {
        SHA256_CTX kc;
        uint8_t h[32];
        sha256_init(&kc); sha256_update(&kc, key, klen); sha256_final(&kc, h);
        memcpy(k0, h, 32);
    } else {
        memcpy(k0, key, klen);
    }
    for (i = 0; i < 64; i++) { inner[i] = k0[i] ^ 0x36; outer[i] = k0[i] ^ 0x5c; }
    sha256_init(&ctx); sha256_update(&ctx, inner, 64);
    sha256_update(&ctx, msg, mlen);
    uint8_t h_inner[32];
    sha256_final(&ctx, h_inner);
    sha256_init(&ctx); sha256_update(&ctx, outer, 64);
    sha256_update(&ctx, h_inner, 32);
    sha256_final(&ctx, out);
}

static void to_hex(const uint8_t *b, size_t n, char *out) {
    static const char *hexd = "0123456789abcdef";
    size_t i;
    for (i = 0; i < n; i++) {
        out[i*2]   = hexd[b[i] >> 4];
        out[i*2+1] = hexd[b[i] & 0xf];
    }
    out[n*2] = 0;
}

static int from_hex(const char *s, uint8_t *out, size_t n) {
    size_t i;
    for (i = 0; i < n; i++) {
        int hi = isxdigit((unsigned char)s[i*2])   ? (isdigit((unsigned char)s[i*2])   ? s[i*2]-'0'   : tolower(s[i*2])-'a'+10) : -1;
        int lo = isxdigit((unsigned char)s[i*2+1]) ? (isdigit((unsigned char)s[i*2+1]) ? s[i*2+1]-'0' : tolower(s[i*2+1])-'a'+10) : -1;
        if (hi < 0 || lo < 0) return -1;
        out[i] = (uint8_t)((hi << 4) | lo);
    }
    return 0;
}

/* PBKDF2-HMAC-SHA256: iter iterations, dkLen bytes. */
static void pbkdf2_sha256(const uint8_t *pw, size_t pwlen,
                          const uint8_t *salt, size_t saltlen,
                          int iter, uint8_t *out, size_t dkLen) {
    uint32_t i = 1;
    size_t blocks = (dkLen + 31) / 32;
    for (uint32_t b = 0; b < blocks; b++) {
        uint8_t saltblock[64], u[32], t[32];
        size_t sl = saltlen < 56 ? saltlen : 56; /* keep space for 4-byte int */
        memcpy(saltblock, salt, sl);
        saltblock[sl]   = (uint8_t)((i >> 24) & 0xff);
        saltblock[sl+1] = (uint8_t)((i >> 16) & 0xff);
        saltblock[sl+2] = (uint8_t)((i >> 8) & 0xff);
        saltblock[sl+3] = (uint8_t)(i & 0xff);
        hmac_sha256(pw, pwlen, saltblock, sl + 4, u);
        memcpy(t, u, 32);
        for (int c = 1; c < iter; c++) {
            hmac_sha256(pw, pwlen, u, 32, u);
            for (int k = 0; k < 32; k++) t[k] ^= u[k];
        }
        size_t copy = (dkLen - b * 32) < 32 ? (dkLen - b * 32) : 32;
        memcpy(out + b * 32, t, copy);
        i++;
    }
}

/* Password -> "salt$hash" string (8 random salt bytes, 32-byte digest). */
static char *hpw(const char *password) {
    uint8_t salt[8], dk[32];
    char salthex[17], hashhex[65], *out;
    int i;
    for (i = 0; i < 8; i++) salt[i] = (uint8_t)(rand() & 0xff);
    pbkdf2_sha256((const uint8_t *)password, strlen(password), salt, 8, PBKDF2_ITER, dk, 32);
    to_hex(salt, 8, salthex);
    to_hex(dk, 32, hashhex);
    out = (char *)malloc(1 + 16 + 1 + 64 + 1);
    sprintf(out, "%s$%s", salthex, hashhex);
    return out;
}

static int chk_password(const char *password, const char *hash) {
    char salthex[17] = {0};
    const char *sp;
    uint8_t salt[8], dk[32];
    char want[65], got[65];
    if (hash == NULL) return 0;
    sp = strchr(hash, '$');
    if (!sp) return 0;
    if ((size_t)(sp - hash) != 16) return 0;
    memcpy(salthex, hash, 16);
    if (from_hex(salthex, salt, 8) != 0) return 0;
    pbkdf2_sha256((const uint8_t *)password, strlen(password), salt, 8, PBKDF2_ITER, dk, 32);
    to_hex(dk, 32, got);
    strncpy(want, sp + 1, 64);
    want[64] = 0;
    return strcmp(want, got) == 0;
}

/* ============================================================================
 * SESSION STORE
 * ==========================================================================*/

typedef struct {
    int      used;
    char     token[40];
    int      id;
    char     name[96];
    char     role[40];
} Session;

static Session        g_sessions[MAX_SESSIONS];
static int            g_sess_n = 0;
static CRITICAL_SECTION g_sess_lock;

static void sess_lock(void)   { EnterCriticalSection(&g_sess_lock); }
static void sess_unlock(void) { LeaveCriticalSection(&g_sess_lock); }

static Session *session_by_token(const char *token) {
    int i;
    Session *s = NULL;
    if (!token) return NULL;
    sess_lock();
    for (i = 0; i < g_sess_n; i++) {
        if (g_sessions[i].used && strcmp(g_sessions[i].token, token) == 0) { s = &g_sessions[i]; break; }
    }
    sess_unlock();
    return s;
}

static void session_add(const char *token, int id, const char *name, const char *role) {
    Session *s;
    sess_lock();
    s = (g_sess_n < MAX_SESSIONS) ? &g_sessions[g_sess_n++] : NULL;
    if (s) {
        s->used = 1;
        strncpy(s->token, token, sizeof(s->token) - 1);
        strncpy(s->name, name, sizeof(s->name) - 1);
        strncpy(s->role, role, sizeof(s->role) - 1);
    }
    sess_unlock();
}

static void gen_token(char out[40]) {
    int i;
    for (i = 0; i < 16; i++) out[i] = (char)('A' + (rand() % 26));
    out[16] = 0;
}

/* ============================================================================
 * DOMAIN + RISK ENGINE
 * ==========================================================================*/

typedef struct {
    int    violation_id;
    int    driver_id, vehicle_id;
    char   violation_type[32];
    char   location[48];
    char   violation_date[16];
    char   violation_time[8];
    char   severity[12];
    int    fine_amount;
    char   payment_status[12];
} Violation;

typedef struct {
    char kind[16];
    char text[256];
} PatternItem;

typedef struct {
    int         score;
    char        level[12];
    int         factors[4];    /* frequency, recent, repeat, severity */
    PatternItem patterns[8];
    int         npatterns;
    int         periods[4];    /* oldest -> newest 30-day windows      */
    char        trend[16];
    int         total;
} RiskResult;

static int load_violations_for_driver(sqlite3 *db, int driver_id, Violation **out) {
    sqlite3_stmt *st = NULL;
    Violation *arr = NULL;
    int cap = 16, n = 0;
    if (sqlite3_prepare_v2(db,
            "select violation_id, driver_id, violation_type, location, violation_date, "
            "violation_time, severity, fine_amount, payment_status from violations "
            "where driver_id=?", -1, &st, NULL) != SQLITE_OK) return 0;
    sqlite3_bind_int(st, 1, driver_id);
    while (sqlite3_step(st) == SQLITE_ROW) {
        if (n >= cap) {
            cap *= 2;
            Violation *na = (Violation *)realloc(arr, (size_t)cap * sizeof(Violation));
            if (!na) break;
            arr = na;
        }
        Violation *v = &arr[n];
        memset(v, 0, sizeof(*v));
        v->violation_id = sqlite3_column_int(st, 0);
        v->driver_id    = sqlite3_column_int(st, 1);
        strncpy(v->violation_type, (const char *)sqlite3_column_text(st, 2), sizeof(v->violation_type)-1);
        strncpy(v->location,       (const char *)sqlite3_column_text(st, 3), sizeof(v->location)-1);
        strncpy(v->violation_date, (const char *)sqlite3_column_text(st, 4), sizeof(v->violation_date)-1);
        strncpy(v->violation_time, (const char *)sqlite3_column_text(st, 5), sizeof(v->violation_time)-1);
        strncpy(v->severity,       (const char *)sqlite3_column_text(st, 6), sizeof(v->severity)-1);
        v->fine_amount = sqlite3_column_int(st, 7);
        strncpy(v->payment_status, (const char *)sqlite3_column_text(st, 8), sizeof(v->payment_status)-1);
        n++;
    }
    sqlite3_finalize(st);
    *out = arr;
    return n;
}

/*
 * Explainable risk score:
 *   30% x frequency (180-day window, cap 8 => x12.5)
 * + 25% x recent    (last 30-day window, cap 3 => x34)
 * + 25% x repeat    (share of records repeating an earlier offence category)
 * + 20% x severity  (mean severity weight)
 */
static RiskResult calculate_risk(Violation *vs, int n) {
    RiskResult r;
    char today[16];
    int i;
    memset(&r, 0, sizeof(r));
    r.total = n;
    today_str(today, sizeof(today));

    /* 4 consecutive 30-day windows: oldest -> newest */
    for (i = 0; i < n; i++) {
        long age = days_between(vs[i].violation_date, today);
        if (age >= 0 && age < 30)       r.periods[3]++;
        else if (age >= 30 && age < 60) r.periods[2]++;
        else if (age >= 60 && age < 90) r.periods[1]++;
        else if (age >= 90 && age < 120) r.periods[0]++;
    }

    if (n == 0) {
        r.score = 0;
        strcpy(r.level, "Low");
        strcpy(r.trend, "No records");
        return r;
    }

    /* Frequency: count in 180-day window */
    long in180 = 0;
    for (i = 0; i < n; i++)
        if (days_between(vs[i].violation_date, today) <= 180) in180++;
    int fFrequency = (int)roundi(fmin(100.0, in180 * 12.5));

    /* Recent: last 30-day window */
    int fRecent = (int)roundi(fmin(100.0, r.periods[3] * 34.0));

    /* Repeat: unique type count */
    char seen[32][32];
    int seen_n = 0, is_repeat, t;
    int fRepeat = 0;
    for (i = 0; i < n; i++) {
        is_repeat = 0;
        for (t = 0; t < seen_n; t++) if (strcmp(seen[t], vs[i].violation_type) == 0) { is_repeat = 1; break; }
        if (!is_repeat && seen_n < 32) {
            strncpy(seen[seen_n++], vs[i].violation_type, 31);
        }
    }
    fRepeat = (int)roundi(((double)(n - seen_n) / n) * 100.0);

    /* Severity: mean of severity weights */
    double sevSum = 0;
    for (i = 0; i < n; i++) sevSum += sev_weight(vs[i].severity);
    int fSeverity = (int)roundi(sevSum / n);

    r.factors[0] = fFrequency;
    r.factors[1] = fRecent;
    r.factors[2] = fRepeat;
    r.factors[3] = fSeverity;

    r.score = (int)roundi(0.30 * fFrequency + 0.25 * fRecent + 0.25 * fRepeat + 0.20 * fSeverity);
    strcpy(r.level, level_str(r.score));

    /* Pattern: >=3 of same type inside 30 days */
    for (t = 0; t < seen_n; t++) {
        char type_dates[64][16];
        int nd = 0, d;
        for (i = 0; i < n; i++)
            if (strcmp(seen[t], vs[i].violation_type) == 0 && nd < 64)
                strcpy(type_dates[nd++], vs[i].violation_date);
        /* insertion sort ascending */
        for (i = 1; i < nd; i++) {
            char key[16];
            strcpy(key, type_dates[i]);
            d = i - 1;
            while (d >= 0 && strcmp(type_dates[d], key) > 0) {
                strcpy(type_dates[d+1], type_dates[d]);
                d--;
            }
            strcpy(type_dates[d+1], key);
        }
        for (i = 0; i + REPEAT_N - 1 < nd; i++) {
            if (days_between(type_dates[i], type_dates[i + REPEAT_N - 1]) <= WINDOW_N) {
                if (r.npatterns < 8) {
                    strcpy(r.patterns[r.npatterns].kind, "repeat");
                    snprintf(r.patterns[r.npatterns].text, sizeof(r.patterns[r.npatterns].text),
                             "Repeated %s: %d+ within %d days", seen[t], REPEAT_N, WINDOW_N);
                    r.npatterns++;
                }
                break;
            }
        }
    }

    /* Rising activity pattern */
    if (r.periods[3] >= 2 && r.periods[3] > r.periods[2]) {
        if (r.npatterns < 8) {
            strcpy(r.patterns[r.npatterns].kind, "increase");
            snprintf(r.patterns[r.npatterns].text, sizeof(r.patterns[r.npatterns].text),
                     "Recent activity increasing: %d in the last 30 days vs %d before",
                     r.periods[3], r.periods[2]);
            r.npatterns++;
        }
    }

    /* Trend */
    if (r.periods[3] < r.periods[2])       strcpy(r.trend, "Improving");
    else if (r.periods[3] > r.periods[2])  strcpy(r.trend, "Worsening");
    else                                   strcpy(r.trend, "Stable");

    return r;
}

/* ============================================================================
 * SMART ALERT PRIORITIZATION (Binary Heap + Comparator)
 * ==========================================================================*/

typedef struct {
    int    alert_id;
    int    driver_id;
    char   driver_name[96];
    char   alert_type[32];
    char   message[512];
    char   severity[16];
    char   status[16];
    char   created_at[24];
    int    priority;
    char   priority_label[12];
    int    risk_score;
    int    urgency;
} AlertItem;

/*
 * Comparator: highest priority first; on ties, newest created_at first.
 * This plays the role of java.util.Comparator in the port.
 */
static int alert_cmp(const AlertItem *a, const AlertItem *b) {
    if (a->priority != b->priority) return b->priority - a->priority;
    return strcmp(b->created_at, a->created_at);
}

typedef struct {
    AlertItem *items;
    int        size, cap;
} AlertHeap;

static void heap_init(AlertHeap *h, int cap) {
    h->cap = cap;
    h->size = 0;
    h->items = (AlertItem *)malloc((size_t)cap * sizeof(AlertItem));
}

static void heap_push(AlertHeap *h, AlertItem *it) {
    int i;
    if (h->size >= h->cap) {
        h->cap *= 2;
        h->items = (AlertItem *)realloc(h->items, (size_t)h->cap * sizeof(AlertItem));
    }
    i = h->size++;
    h->items[i] = *it;
    while (i > 0) {
        int parent = (i - 1) / 2;
        if (alert_cmp(&h->items[i], &h->items[parent]) < 0) {
            AlertItem tmp = h->items[i];
            h->items[i] = h->items[parent];
            h->items[parent] = tmp;
            i = parent;
        } else break;
    }
}

static AlertItem *heap_pop(AlertHeap *h) {
    AlertItem *top;
    int i;
    if (h->size == 0) return NULL;
    top = &h->items[0];
    h->items[0] = h->items[--h->size];
    i = 0;
    for (;;) {
        int l = 2*i + 1, r = 2*i + 2, best = i;
        if (l < h->size && alert_cmp(&h->items[l], &h->items[best]) < 0) best = l;
        if (r < h->size && alert_cmp(&h->items[r], &h->items[best]) < 0) best = r;
        if (best == i) break;
        AlertItem tmp = h->items[i];
        h->items[i] = h->items[best];
        h->items[best] = tmp;
        i = best;
    }
    return top;
}

/* 0-100 urgency of an alert from its age and workflow status. */
static int urgency_score(const char *created_at, int open) {
    long days = days_open_since(created_at);
    if (open) return (int)fmin(100, 40 + days * 8);
    return (int)fmin(100, 15 + days * 3);
}

/* Weighted 0-100 priority: severity 50%, driver risk 30%, urgency 20%. */
static int alert_priority(const char *severity, int risk_score, int urgency) {
    double sevW = alert_sev_weight(severity);
    double risk = fmin(100, fmax(0, risk_score));
    double urg  = fmin(100, fmax(0, urgency));
    return (int)roundi(0.50 * sevW + 0.30 * risk + 0.20 * urg);
}

static const char *priority_label(int p) {
    if (p >= 81) return "Critical";
    if (p >= 61) return "High";
    if (p >= 41) return "Medium";
    if (p >= 21) return "Low";
    return "Info";
}

/* ============================================================================
 * ALERT GENERATION
 * ==========================================================================*/

static int refresh_alerts(sqlite3 *db, int driver_id) {
    Violation *vs = NULL;
    int n = load_violations_for_driver(db, driver_id, &vs);
    RiskResult r = calculate_risk(vs, n);
    int new_count = 0, i;
    char nowbuf[24];
    now_str(nowbuf, sizeof(nowbuf));

    struct Cand { char type[32]; char msg[512]; char sev[12]; } cands[12];
    int nc = 0;

    for (i = 0; i < r.npatterns; i++) {
        const char *type = strcmp(r.patterns[i].kind, "repeat") == 0 ? "Repeated Violation" : "Frequency Increase";
        if (nc < 12) {
            strncpy(cands[nc].type, type, sizeof(cands[nc].type)-1);
            strncpy(cands[nc].msg, r.patterns[i].text, sizeof(cands[nc].msg)-1);
            strcpy(cands[nc].sev, "Medium");
            nc++;
        }
    }

    if (r.score >= 61) {
        const char *sev = r.score <= 80 ? "High" : "Critical";
        if (nc < 12) {
            strcpy(cands[nc].type, "High Risk Review");
            snprintf(cands[nc].msg, sizeof(cands[nc].msg),
                     "Risk score %d/100 (%s) with %d violations in the available records",
                     r.score, r.level, r.total);
            strncpy(cands[nc].sev, sev, sizeof(cands[nc].sev)-1);
            nc++;
        }
    }

    if (strcmp(r.trend, "Improving") == 0 && r.total >= 3) {
        if (nc < 12) {
            strcpy(cands[nc].type, "Improvement Trend");
            snprintf(cands[nc].msg, sizeof(cands[nc].msg),
                     "Recorded violations fell from %d to %d in the latest 30 days",
                     r.periods[2], r.periods[3]);
            strcpy(cands[nc].sev, "Info");
            nc++;
        }
    }

    for (i = 0; i < nc; i++) {
        sqlite3_stmt *st = NULL;
        if (sqlite3_prepare_v2(db,
                "select 1 from alerts where driver_id=? and alert_type=? and status='Open'",
                -1, &st, NULL) != SQLITE_OK) continue;
        sqlite3_bind_int(st, 1, driver_id);
        sqlite3_bind_text(st, 2, cands[i].type, -1, SQLITE_TRANSIENT);
        int exists = 0;
        if (sqlite3_step(st) == SQLITE_ROW) exists = 1;
        sqlite3_finalize(st);
        if (!exists) {
            if (sqlite3_prepare_v2(db,
                    "insert into alerts(driver_id,alert_type,message,severity,created_at,status) "
                    "values(?,?,?,?,?,'Open')", -1, &st, NULL) == SQLITE_OK) {
                sqlite3_bind_int(st, 1, driver_id);
                sqlite3_bind_text(st, 2, cands[i].type, -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(st, 3, cands[i].msg, -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(st, 4, cands[i].sev, -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(st, 5, nowbuf, -1, SQLITE_TRANSIENT);
                if (sqlite3_step(st) == SQLITE_DONE) new_count++;
                sqlite3_finalize(st);
            }
        }
    }

    free(vs);
    return new_count;
}

/* ============================================================================
 * JSON BUILDER
 * ==========================================================================*/

typedef struct {
    char  *buf;
    size_t len, cap;
} Jb;

static void jb_init(Jb *b) {
    b->cap = 1024;
    b->len = 0;
    b->buf = (char *)malloc(b->cap);
    b->buf[0] = 0;
}

static void jb_grow(Jb *b, size_t need) {
    if (b->len + need + 1 > b->cap) {
        b->cap = (b->len + need + 1) * 2;
        b->buf = (char *)realloc(b->buf, b->cap);
    }
}

static void jb_put(Jb *b, const char *s) {
    size_t n = strlen(s);
    jb_grow(b, n);
    memcpy(b->buf + b->len, s, n);
    b->len += n;
    b->buf[b->len] = 0;
}

static void jb_putc(Jb *b, char c) {
    jb_grow(b, 1);
    b->buf[b->len++] = c;
    b->buf[b->len] = 0;
}

static void jb_putf(Jb *b, const char *fmt, ...) {
    char tmp[1024];
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(tmp, sizeof(tmp), fmt, ap);
    va_end(ap);
    jb_put(b, tmp);
}

/* JSON string with escaping. */
static void jb_json_str(Jb *b, const char *s) {
    const char *p;
    char esc[16];
    if (!s) { jb_put(b, "null"); return; }
    jb_putc(b, '"');
    for (p = s; *p; p++) {
        unsigned char ch = (unsigned char)*p;
        switch (ch) {
            case '"':  jb_put(b, "\\\""); break;
            case '\\': jb_put(b, "\\\\"); break;
            case '\b': jb_put(b, "\\b");  break;
            case '\f': jb_put(b, "\\f");  break;
            case '\n': jb_put(b, "\\n");  break;
            case '\r': jb_put(b, "\\r");  break;
            case '\t': jb_put(b, "\\t");  break;
            default:
                if (ch < 0x20) {
                    sprintf(esc, "\\u%04x", ch);
                    jb_put(b, esc);
                } else {
                    jb_putc(b, (char)ch);
                }
        }
    }
    jb_putc(b, '"');
}

static void jb_json_int(Jb *b, long v)  { jb_putf(b, "%ld", v); }

/* ============================================================================
 * ANALYTICS
 * ==========================================================================*/

typedef struct {
    char location[48];
    long count, recent30;
    int  hotspot;
    char top_type[32];
} LocRow;

typedef struct {
    char name[32];
    long count;
} TypeRow;

/* Row comparator: highest count first, name as tie-break. */
static int row_cmp_desc(const void *A, const void *B) {
    const TypeRow *a = (const TypeRow *)A, *b = (const TypeRow *)B;
    if (a->count != b->count) return a->count < b->count ? 1 : -1;
    return strcmp(a->name, b->name);
}
static int loc_cmp_desc(const void *A, const void *B) {
    const LocRow *a = (const LocRow *)A, *b = (const LocRow *)B;
    if (a->count != b->count) return a->count < b->count ? 1 : -1;
    return strcmp(a->location, b->location);
}

/* Builds the full /api/analytics JSON document. */
static void build_analytics_json(sqlite3 *db, Jb *out) {
    sqlite3_stmt *st = NULL;
    int i;
    char today[16];
    today_str(today, sizeof(today));

    /* Full violation scan */
    TypeRow types[32]; int nt = 0;
    LocRow  locs[32];  int nl = 0;
    long hours[24] = {0};
    const char *period_names[4] = {"Morning","Afternoon","Evening","Night"};
    long periods[4] = {0};
    const char *dow_names[7] = {"Mon","Tue","Wed","Thu","Fri","Sat","Sun"};
    long dow_counts[7] = {0};
    long months[8] = {0};
    char month_keys[8][8];
    long total_violations = 0, pending_count = 0, pending_amount = 0;
    long hotspots_total = 0;

    /* build month keys: last 8 months ending this month */
    {
        time_t t = time(NULL);
        struct tm tm = *localtime(&t);
        int cur_month = tm.tm_mon, cur_year = tm.tm_year + 1900;
        for (i = 0; i < 8; i++) {
            int y = cur_year, m = cur_month - (7 - i);
            while (m < 0) { m += 12; y--; }
            sprintf(month_keys[i], "%04d-%02d", y, m + 1);
        }
    }

    sqlite3_prepare_v2(db,
        "select violation_type, location, violation_date, violation_time from violations", -1, &st, NULL);
    while (sqlite3_step(st) == SQLITE_ROW) {
        const char *type = (const char *)sqlite3_column_text(st, 0);
        const char *loc  = (const char *)sqlite3_column_text(st, 1);
        const char *date = (const char *)sqlite3_column_text(st, 2);
        const char *time = (const char *)sqlite3_column_text(st, 3);
        int found, hour = 0;
        total_violations++;

        found = 0;
        for (i = 0; i < nt; i++) if (strcmp(types[i].name, type) == 0) { types[i].count++; found = 1; break; }
        if (!found && nt < 32) { strncpy(types[nt].name, type, 31); types[nt].count = 1; nt++; }

        found = 0;
        for (i = 0; i < nl; i++) if (strcmp(locs[i].location, loc) == 0) { locs[i].count++; found = 1; break; }
        if (!found && nl < 32) { strncpy(locs[nl].location, loc, 47); locs[nl].count = 1; locs[nl].recent30 = 0; nl++; }

        if (date && time && strlen(date) >= 10 && strlen(time) >= 2) {
            if (days_between(date, today) <= 30) {
                for (i = 0; i < nl; i++) if (strcmp(locs[i].location, loc) == 0) locs[i].recent30++;
            }
            hour = atoi(time);
            if (hour >= 0 && hour < 24) hours[hour]++;
            if (strncmp(date, month_keys[i < 0 ? 0 : 0], 0) == -1) { /* no-op guard */ }
        }
        if (date && strlen(date) >= 7) {
            char mk[8];
            strncpy(mk, date, 7); mk[7] = 0;
            for (i = 0; i < 8; i++) if (strcmp(mk, month_keys[i]) == 0) { months[i]++; break; }
        }
        /* day of week from date */
        if (date && strlen(date) == 10) {
            int y, mo, d;
            if (sscanf(date, "%d-%d-%d", &y, &mo, &d) == 3) {
                /* Zeller's congruence: 0=Sat ... use tm_wday instead */
            }
        }
    }
    sqlite3_finalize(st);

    /* day-of-week via tm_wday */
    sqlite3_prepare_v2(db, "select violation_date from violations", -1, &st, NULL);
    while (sqlite3_step(st) == SQLITE_ROW) {
        const char *date = (const char *)sqlite3_column_text(st, 0);
        int y, mo, d;
        if (date && sscanf(date, "%d-%d-%d", &y, &mo, &d) == 3) {
            time_t tt;
            struct tm tm;
            memset(&tm, 0, sizeof(tm));
            tm.tm_year = y - 1900; tm.tm_mon = mo - 1; tm.tm_mday = d;
            tt = mktime(&tm);
            struct tm *out_tm = localtime(&tt);
            if (out_tm) {
                int wd = out_tm->tm_wday; /* 0=Sun */
                int idx = (wd + 6) % 7;   /* 0=Mon */
                if (idx >= 0 && idx < 7) dow_counts[idx]++;
            }
        }
    }
    sqlite3_finalize(st);

    /* periods from hours */
    for (i = 0; i < 24; i++) {
        const char *p = period_str(i);
        if (strcmp(p, "Morning") == 0) periods[0] += hours[i];
        else if (strcmp(p, "Afternoon") == 0) periods[1] += hours[i];
        else if (strcmp(p, "Evening") == 0) periods[2] += hours[i];
        else periods[3] += hours[i];
    }

    /* hotspot threshold = 1.25 x average */
    double avg = nl ? (double)total_violations / nl : 1.0;
    long thr = (long)floor(avg * HOTSPOT_FACTOR);
    for (i = 0; i < nl; i++) {
        locs[i].hotspot = locs[i].count > thr;
        if (locs[i].hotspot) hotspots_total++;
    }

    /* top type and payment stats */
    char top_type[32] = "-"; long top_count = -1;
    {
        double sev_sum = 0; (void)sev_sum;
    }
    sqlite3_prepare_v2(db, "select payment_status, fine_amount from violations", -1, &st, NULL);
    while (sqlite3_step(st) == SQLITE_ROW) {
        const char *ps = (const char *)sqlite3_column_text(st, 0);
        if (ps && strcmp(ps, "Pending") == 0) {
            pending_count++;
            pending_amount += sqlite3_column_int(st, 1);
        }
    }
    sqlite3_finalize(st);

    /* top violation + dominant type per location */
    qsort(types, (size_t)nt, sizeof(TypeRow), row_cmp_desc);
    qsort(locs, (size_t)nl, sizeof(LocRow), loc_cmp_desc);
    if (types) { top_count = 0; }

    /* dominant type per location needs a per-location scan */
    {
        sqlite3_stmt *lq = NULL;
        int li;
        for (li = 0; li < nl; li++) {
            long best = -1;
            char best_name[32] = "-";
            if (sqlite3_prepare_v2(db,
                    "select violation_type, count(*) from violations where location=? group by violation_type",
                    -1, &lq, NULL) == SQLITE_OK) {
                sqlite3_bind_text(lq, 1, locs[li].location, -1, SQLITE_TRANSIENT);
                while (sqlite3_step(lq) == SQLITE_ROW) {
                    const char *nm = (const char *)sqlite3_column_text(lq, 0);
                    long cnt = sqlite3_column_int64(lq, 1);
                    if (cnt > best) { best = cnt; strncpy(best_name, nm, 31); }
                }
                sqlite3_finalize(lq);
            }
            strncpy(locs[li].top_type, best_name, sizeof(locs[li].top_type)-1);
        }
    }
    if (nt > 0) strncpy(top_type, types[0].name, sizeof(top_type)-1);

    /* driver count, risk distribution, high risk */
    long driver_count = 0, veh_count = 0, high_risk = 0;
    long risk_dist[4] = {0};
    {
        sqlite3_stmt *d = NULL;
        if (sqlite3_prepare_v2(db, "select driver_id from drivers", -1, &d, NULL) == SQLITE_OK) {
            while (sqlite3_step(d) == SQLITE_ROW) {
                int did = sqlite3_column_int(d, 0);
                Violation *vs = NULL;
                int n = load_violations_for_driver(db, did, &vs);
                RiskResult r = calculate_risk(vs, n);
                if (strcmp(r.level, "Low") == 0) risk_dist[0]++;
                else if (strcmp(r.level, "Medium") == 0) risk_dist[1]++;
                else if (strcmp(r.level, "High") == 0) risk_dist[2]++;
                else risk_dist[3]++;
                if (r.score >= 61) high_risk++;
                free(vs);
                driver_count++;
            }
            sqlite3_finalize(d);
        }
        st = NULL;
        if (sqlite3_prepare_v2(db, "select count(*) from vehicles", -1, &st, NULL) == SQLITE_OK) {
            if (sqlite3_step(st) == SQLITE_ROW) veh_count = sqlite3_column_int64(st, 0);
            sqlite3_finalize(st);
        }
    }

    /* peak period */
    int peak_period_idx = 0;
    for (i = 1; i < 4; i++) if (periods[i] > periods[peak_period_idx]) peak_period_idx = i;
    /* peak hour */
    int peak_hour = 0;
    for (i = 1; i < 24; i++) if (hours[i] > hours[peak_hour]) peak_hour = i;

    const char *top_hotspot = "-";
    for (i = 0; i < nl; i++) if (locs[i].hotspot) { top_hotspot = locs[i].location; break; }

    /* Emit JSON */
    jb_putc(out, '{');

    jb_put(out, "\"stats\":{");
    jb_putf(out, "\"drivers\":%ld,", driver_count);
    jb_putf(out, "\"vehicles\":%ld,", veh_count);
    jb_putf(out, "\"violations\":%ld,", total_violations);
    jb_putf(out, "\"pending_count\":%ld,", pending_count);
    jb_putf(out, "\"pending_amount\":%ld,", pending_amount);
    jb_putf(out, "\"high_risk\":%ld,", high_risk);
    jb_put(out, "\"top_violation\":"); jb_json_str(out, top_type); jb_putc(out, ',');
    jb_put(out, "\"top_hotspot\":"); jb_json_str(out, top_hotspot); jb_putc(out, ',');
    jb_put(out, "\"peak_period\":"); jb_json_str(out, period_names[peak_period_idx]); jb_putc(out, ',');
    jb_putf(out, "\"hotspots\":%ld", hotspots_total);
    jb_putc(out, '}');

    jb_put(out, ",\"by_type\":[");
    for (i = 0; i < nt; i++) {
        if (i) jb_putc(out, ',');
        jb_putc(out, '['); jb_json_str(out, types[i].name); jb_putc(out, ','); jb_json_int(out, types[i].count); jb_putc(out, ']');
    }
    jb_putc(out, ']');

    jb_put(out, ",\"by_location\":[");
    for (i = 0; i < nl; i++) {
        if (i) jb_putc(out, ',');
        jb_putc(out, '{');
        jb_put(out, "\"location\":"); jb_json_str(out, locs[i].location); jb_putc(out, ',');
        jb_putf(out, "\"count\":%ld,", locs[i].count);
        jb_putf(out, "\"hotspot\":%s,", locs[i].hotspot ? "true" : "false");
        jb_putf(out, "\"recent30\":%ld,", locs[i].recent30);
        jb_put(out, "\"top_type\":"); jb_json_str(out, locs[i].top_type);
        jb_putc(out, '}');
    }
    jb_putc(out, ']');

    jb_put(out, ",\"by_period\":[");
    for (i = 0; i < 4; i++) {
        if (i) jb_putc(out, ',');
        jb_putc(out, '['); jb_json_str(out, period_names[i]); jb_putc(out, ','); jb_json_int(out, periods[i]); jb_putc(out, ']');
    }
    jb_putc(out, ']');

    jb_put(out, ",\"by_hour\":[");
    for (i = 0; i < 24; i++) {
        if (i) jb_putc(out, ',');
        jb_putc(out, '[');
        jb_putf(out, "\"%02d:00\"", i);
        jb_putc(out, ',');
        jb_json_int(out, hours[i]);
        jb_putc(out, ']');
    }
    jb_putc(out, ']');

    jb_put(out, ",\"by_dow\":[");
    for (i = 0; i < 7; i++) {
        if (i) jb_putc(out, ',');
        jb_putc(out, '['); jb_json_str(out, dow_names[i]); jb_putc(out, ','); jb_json_int(out, dow_counts[i]); jb_putc(out, ']');
    }
    jb_putc(out, ']');

    jb_put(out, ",\"by_month\":[");
    for (i = 0; i < 8; i++) {
        if (i) jb_putc(out, ',');
        jb_putc(out, '['); jb_json_str(out, month_keys[i]); jb_putc(out, ','); jb_json_int(out, months[i]); jb_putc(out, ']');
    }
    jb_putc(out, ']');

    jb_put(out, ",\"risk_dist\":[");
    {
        const char *levels[4] = {"Low","Medium","High","Critical"};
        for (i = 0; i < 4; i++) {
            if (i) jb_putc(out, ',');
            jb_putc(out, '['); jb_json_str(out, levels[i]); jb_putc(out, ','); jb_json_int(out, risk_dist[i]); jb_putc(out, ']');
        }
    }
    jb_putc(out, ']');

    jb_putc(out, '}');
}

/* Serialize a RiskResult as a JSON object. */
static void risk_to_json(Jb *out, const RiskResult *r) {
    int i;
    jb_putc(out, '{');
    jb_putf(out, "\"score\":%d,", r->score);
    jb_put(out, "\"level\":"); jb_json_str(out, r->level); jb_putc(out, ',');
    jb_put(out, "\"factors\":{");
    jb_putf(out, "\"frequency\":%d,", r->factors[0]);
    jb_putf(out, "\"recent\":%d,", r->factors[1]);
    jb_putf(out, "\"repeat\":%d,", r->factors[2]);
    jb_putf(out, "\"severity\":%d", r->factors[3]);
    jb_putc(out, '}');
    jb_put(out, ",\"patterns\":[");
    for (i = 0; i < r->npatterns; i++) {
        if (i) jb_putc(out, ',');
        jb_putc(out, '{');
        jb_put(out, "\"kind\":"); jb_json_str(out, r->patterns[i].kind); jb_putc(out, ',');
        jb_put(out, "\"text\":"); jb_json_str(out, r->patterns[i].text);
        jb_putc(out, '}');
    }
    jb_putc(out, ']');
    jb_put(out, ",\"periods\":[");
    for (i = 0; i < 4; i++) {
        if (i) jb_putc(out, ',');
        jb_json_int(out, r->periods[i]);
    }
    jb_putc(out, ']');
    jb_put(out, ",\"trend\":"); jb_json_str(out, r->trend);
    jb_putf(out, ",\"total\":%d", r->total);
    jb_putc(out, '}');
}

/* ============================================================================
 * DRIVER DETAIL
 * ==========================================================================*/

static void build_driver_detail_json(sqlite3 *db, int did, Jb *out) {
    sqlite3_stmt *st = NULL;
    int i;
    char name[96] = "-", lic[48] = "-", phone[16] = "-", addr[128] = "-";
    int found = 0;

    if (sqlite3_prepare_v2(db, "select name, license_number, phone, address from drivers where driver_id=?",
                           -1, &st, NULL) == SQLITE_OK) {
        sqlite3_bind_int(st, 1, did);
        if (sqlite3_step(st) == SQLITE_ROW) {
            found = 1;
            strncpy(name, (const char *)sqlite3_column_text(st, 0), sizeof(name)-1);
            strncpy(lic,  (const char *)sqlite3_column_text(st, 1), sizeof(lic)-1);
            strncpy(phone,(const char *)sqlite3_column_text(st, 2), sizeof(phone)-1);
            strncpy(addr, (const char *)sqlite3_column_text(st, 3), sizeof(addr)-1);
        }
        sqlite3_finalize(st);
    }
    if (!found) { jb_put(out, "null"); return; }

    jb_putc(out, '{');
    jb_put(out, "\"driver\":{");
    jb_putf(out, "\"driver_id\":%d,", did);
    jb_put(out, "\"name\":"); jb_json_str(out, name); jb_putc(out, ',');
    jb_put(out, "\"license_number\":"); jb_json_str(out, lic); jb_putc(out, ',');
    jb_put(out, "\"phone\":"); jb_json_str(out, phone); jb_putc(out, ',');
    jb_put(out, "\"address\":"); jb_json_str(out, addr);
    jb_putc(out, '}');

    jb_put(out, ",\"vehicles\":[");
    if (sqlite3_prepare_v2(db, "select vehicle_id, vehicle_number, vehicle_type, model from vehicles where driver_id=?",
                           -1, &st, NULL) == SQLITE_OK) {
        sqlite3_bind_int(st, 1, did);
        i = 0;
        while (sqlite3_step(st) == SQLITE_ROW) {
            if (i++) jb_putc(out, ',');
            jb_putc(out, '{');
            jb_putf(out, "\"vehicle_id\":%d,", sqlite3_column_int(st, 0));
            jb_put(out, "\"vehicle_number\":"); jb_json_str(out, (const char *)sqlite3_column_text(st, 1)); jb_putc(out, ',');
            jb_put(out, "\"vehicle_type\":"); jb_json_str(out, (const char *)sqlite3_column_text(st, 2)); jb_putc(out, ',');
            jb_put(out, "\"model\":"); jb_json_str(out, (const char *)sqlite3_column_text(st, 3));
            jb_putc(out, '}');
        }
        sqlite3_finalize(st);
    }
    jb_putc(out, ']');

    Violation *vs = NULL;
    int n = load_violations_for_driver(db, did, &vs);
    RiskResult r = calculate_risk(vs, n);

    jb_put(out, ",\"violations\":[");
    {
        sqlite3_stmt *vq = NULL;
        if (sqlite3_prepare_v2(db,
                "select v.violation_id, v.violation_date, v.violation_time, v.violation_type, v.location, "
                "v.fine_amount, v.payment_status, ve.vehicle_number from violations v "
                "join vehicles ve on ve.vehicle_id=v.vehicle_id where v.driver_id=? "
                "order by v.violation_date desc, v.violation_time desc", -1, &vq, NULL) == SQLITE_OK) {
            sqlite3_bind_int(vq, 1, did);
            i = 0;
            while (sqlite3_step(vq) == SQLITE_ROW) {
                if (i++) jb_putc(out, ',');
                jb_putc(out, '{');
                jb_putf(out, "\"violation_id\":%d,", sqlite3_column_int(vq, 0));
                jb_put(out, "\"violation_date\":"); jb_json_str(out, (const char *)sqlite3_column_text(vq, 1)); jb_putc(out, ',');
                jb_put(out, "\"violation_time\":"); jb_json_str(out, (const char *)sqlite3_column_text(vq, 2)); jb_putc(out, ',');
                jb_put(out, "\"violation_type\":"); jb_json_str(out, (const char *)sqlite3_column_text(vq, 3)); jb_putc(out, ',');
                jb_put(out, "\"location\":"); jb_json_str(out, (const char *)sqlite3_column_text(vq, 4)); jb_putc(out, ',');
                jb_putf(out, "\"fine_amount\":%d,", sqlite3_column_int(vq, 5));
                jb_put(out, "\"payment_status\":"); jb_json_str(out, (const char *)sqlite3_column_text(vq, 6)); jb_putc(out, ',');
                jb_put(out, "\"vehicle_number\":"); jb_json_str(out, (const char *)sqlite3_column_text(vq, 7));
                jb_putc(out, '}');
            }
            sqlite3_finalize(vq);
        }
    }
    jb_putc(out, ']');

    jb_put(out, ",\"risk\":"); risk_to_json(out, &r);

    jb_put(out, ",\"alerts\":[");
    if (sqlite3_prepare_v2(db, "select alert_id, alert_type, message, severity, created_at, status from alerts where driver_id=? order by alert_id desc",
                           -1, &st, NULL) == SQLITE_OK) {
        sqlite3_bind_int(st, 1, did);
        i = 0;
        while (sqlite3_step(st) == SQLITE_ROW) {
            if (i++) jb_putc(out, ',');
            jb_putc(out, '{');
            jb_putf(out, "\"alert_id\":%d,", sqlite3_column_int(st, 0));
            jb_put(out, "\"alert_type\":"); jb_json_str(out, (const char *)sqlite3_column_text(st, 1)); jb_putc(out, ',');
            jb_put(out, "\"message\":"); jb_json_str(out, (const char *)sqlite3_column_text(st, 2)); jb_putc(out, ',');
            jb_put(out, "\"severity\":"); jb_json_str(out, (const char *)sqlite3_column_text(st, 3)); jb_putc(out, ',');
            jb_put(out, "\"created_at\":"); jb_json_str(out, (const char *)sqlite3_column_text(st, 4)); jb_putc(out, ',');
            jb_put(out, "\"status\":"); jb_json_str(out, (const char *)sqlite3_column_text(st, 5));
            jb_putc(out, '}');
        }
        sqlite3_finalize(st);
    }
    jb_putc(out, ']');

    jb_putc(out, '}');
    free(vs);
}

/* ============================================================================
 * REPORTS (plain text / CSV)
 * ==========================================================================*/

static void generate_report(sqlite3 *db, const char *kind, const char *arg, Jb *out) {
    char nowbuf[24];
    now_str(nowbuf, sizeof(nowbuf));
    char upkind[32];
    int ki;
    for (ki = 0; kind[ki] && ki < 31; ki++) upkind[ki] = (char)toupper((unsigned char)kind[ki]);
    upkind[ki] = 0;

    char head[512];
    snprintf(head, sizeof(head),
             "ROADWISE - %s REPORT\nGenerated: %s\nPrototype rules, synthetic data. Decision support only - not an official score or legal decision.\n\n",
             upkind, nowbuf);
    jb_put(out, head);

    Jb a;
    jb_init(&a);
    build_analytics_json(db, &a);
    /* analytics is JSON; for the summary we need stats - re-query directly below */

    if (strcmp(kind, "summary") == 0) {
        long drivers=0, vehicles=0, violations=0, pending_count=0, pending_amount=0, high_risk=0, hotspots=0;
        sqlite3_stmt *st = NULL;
        sqlite3_prepare_v2(db, "select count(*) from drivers", -1, &st, NULL);
        if (sqlite3_step(st)==SQLITE_ROW) drivers = sqlite3_column_int64(st,0); sqlite3_finalize(st);
        sqlite3_prepare_v2(db, "select count(*) from vehicles", -1, &st, NULL);
        if (sqlite3_step(st)==SQLITE_ROW) vehicles = sqlite3_column_int64(st,0); sqlite3_finalize(st);
        sqlite3_prepare_v2(db, "select count(*) from violations", -1, &st, NULL);
        if (sqlite3_step(st)==SQLITE_ROW) violations = sqlite3_column_int64(st,0); sqlite3_finalize(st);
        sqlite3_prepare_v2(db, "select count(*), coalesce(sum(fine_amount),0) from violations where payment_status='Pending'", -1, &st, NULL);
        if (sqlite3_step(st)==SQLITE_ROW) { pending_count = sqlite3_column_int64(st,0); pending_amount = sqlite3_column_int64(st,1); } sqlite3_finalize(st);
        sqlite3_prepare_v2(db, "select count(*) from violations group by driver_id having sum(1)>=0", -1, &st, NULL);
        /* high risk count and hotspots need engine: pragmatic approximation via full scan */
        sqlite3_finalize(st);
        Jb tmp;
        jb_init(&tmp);
        build_analytics_json(db, &tmp);
        /* grep high_risk and hotspots from the JSON string */
        char *h = tmp.buf;
        char *hp = strstr(h, "\"high_risk\":");
        if (hp) high_risk = atol(hp + 11);
        hp = strstr(h, "\"hotspots\":");
        if (hp) hotspots = atol(hp + 11);
        jb_putf(out, "Drivers: %ld\nVehicles: %ld\nViolations: %ld\nPending count: %ld\nPending amount: %ld\nHigh risk: %ld\nHotspots: %ld\n",
                drivers, vehicles, violations, pending_count, pending_amount, high_risk, hotspots);
        jb_put(out, "\nViolations by type:\n");
        {
            sqlite3_stmt *tq = NULL;
            if (sqlite3_prepare_v2(db, "select violation_type, count(*) from violations group by violation_type order by 2 desc", -1, &tq, NULL) == SQLITE_OK) {
                while (sqlite3_step(tq) == SQLITE_ROW)
                    jb_putf(out, "  %s: %lld\n", (const char *)sqlite3_column_text(tq, 0), sqlite3_column_int64(tq, 1));
                sqlite3_finalize(tq);
            }
        }
        free(tmp.buf);
    } else if (strcmp(kind, "hotspot") == 0) {
        Jb tmp;
        jb_init(&tmp);
        build_analytics_json(db, &tmp);
        char *p = tmp.buf, *end = p + tmp.len;
        char *loc = strstr(p, "\"by_location\":[");
        if (loc) {
            /* extract each object's fields with a tiny scanner */
            char *q = loc + strlen("\"by_location\":[");
            while (q && q < end) {
                char *ob = strchr(q, '{');
                if (!ob) break;
                char *cl = strchr(ob, '}');
                if (!cl) break;
                *cl = 0;
                char *fname = strstr(ob, "\"location\":");
                char *fcnt = strstr(ob, "\"count\":");
                char *frec = strstr(ob, "\"recent30\":");
                char *ftop = strstr(ob, "\"top_type\":");
                char locname[96] = "-", topt[64] = "-";
                long cnt = 0, rec = 0;
                if (fname) { const char *s = fname + 11; if (*s=='"') { s++; const char *e = strchr(s, '"'); if (e) { size_t z = (size_t)(e-s); if (z>95) z=95; memcpy(locname, s, z); locname[z]=0; } } }
                if (fcnt) cnt = atol(fcnt + 7);
                if (frec) rec = atol(frec + 10);
                if (ftop) { const char *s = ftop + 10; if (*s=='"') { s++; const char *e = strchr(s, '"'); if (e) { size_t z = (size_t)(e-s); if (z>63) z=63; memcpy(topt, s, z); topt[z]=0; } } }
                int hotspot = strstr(ob, "\"hotspot\":true") != NULL;
                jb_putf(out, "%s: %ld total, %ld in last 30 days, top type %s%s\n",
                        locname, cnt, rec, topt, hotspot ? "  [HOTSPOT]" : "");
                *cl = '}';
                q = cl + 2;
                if (*q != ',' && *q != ']') break;
            }
        }
        free(tmp.buf);
    } else if (strcmp(kind, "time") == 0) {
        Jb tmp;
        jb_init(&tmp);
        build_analytics_json(db, &tmp);
        char *p = tmp.buf, *end = p + tmp.len;
        char *byp = strstr(p, "\"by_period\":[");
        char *byd = strstr(p, "\"by_dow\":[");
        char *byh = strstr(p, "\"by_hour\":[");
        jb_put(out, "By period:\n");
        if (byp) {
            char *q = byp + strlen("\"by_period\":[");
            while (q && q < end && *q != ']') {
                if (*q == '[') {
                    char *nm = q+1, *cn = strchr(nm, ',');
                    if (cn && *(cn+1)) { long c = atol(cn+1); char name[32]; size_t z=(size_t)(cn-nm); if(z>31) z=31; memcpy(name,nm,z); name[z]=0; jb_putf(out, "  %s: %ld\n", name, c); }
                    q = strchr(cn, ']'); if (!q) break;
                    q = q+1;
                } else q++;
            }
        }
        jb_put(out, "By day:\n");
        if (byd) {
            char *q = byd + strlen("\"by_dow\":[");
            while (q && q < end && *q != ']') {
                if (*q == '[') {
                    char *nm = q+1, *cn = strchr(nm, ',');
                    if (cn && *(cn+1)) { long c = atol(cn+1); char name[32]; size_t z=(size_t)(cn-nm); if(z>31) z=31; memcpy(name,nm,z); name[z]=0; jb_putf(out, "  %s: %ld\n", name, c); }
                    q = strchr(cn, ']'); if (!q) break;
                    q = q+1;
                } else q++;
            }
        }
        jb_put(out, "By hour:\n");
        if (byh) {
            char *q = byh + strlen("\"by_hour\":[");
            while (q && q < end && *q != ']') {
                if (*q == '[') {
                    char *nm = q+1, *cn = strchr(nm, ',');
                    if (cn && *(cn+1)) { long c = atol(cn+1); char name[32]; size_t z=(size_t)(cn-nm); if (z>0 && nm[0]=='"') { nm++; z--; } if(z>31) z=31; memcpy(name,nm,z); name[z]=0; jb_putf(out, "  %s  %ld\n", name, c); }
                    q = strchr(cn, ']'); if (!q) break;
                    q = q+1;
                } else q++;
            }
        }
        free(tmp.buf);
    } else if (strcmp(kind, "risk") == 0) {
        Jb tmp;
        jb_init(&tmp);
        build_analytics_json(db, &tmp);
        char *h = tmp.buf;
        char *rd = strstr(h, "\"risk_dist\":[");
        if (rd) {
            char *q = rd + strlen("\"risk_dist\":[");
            while (q && *q && *q != ']') {
                if (*q == '[') {
                    char *nm = q+1, *cn = strchr(nm, ',');
                    if (cn && *(cn+1)) { long c = atol(cn+1); char name[32]; size_t z=(size_t)(cn-nm); if(z>31) z=31; memcpy(name,nm,z); name[z]=0; jb_putf(out, "%s: %ld drivers\n", name, c); }
                    q = strchr(cn, ']'); if (!q) break;
                    q = q+1;
                } else q++;
            }
        }
        free(tmp.buf);
    } else if (strcmp(kind, "improvement") == 0) {
        Jb tmp;
        jb_init(&tmp);
        build_analytics_json(db, &tmp);
        char *h = tmp.buf;
        char *bm = strstr(h, "\"by_month\":[");
        if (bm) {
            char *q = bm + strlen("\"by_month\":[");
            while (q && *q && *q != ']') {
                if (*q == '[') {
                    char *nm = q+1, *cn = strchr(nm, ',');
                    if (cn && *(cn+1)) { long c = atol(cn+1); char name[16]; size_t z=(size_t)(cn-nm); if(z>15) z=15; memcpy(name,nm,z); name[z]=0; jb_putf(out, "%s: %ld violations\n", name, c); }
                    q = strchr(cn, ']'); if (!q) break;
                    q = q+1;
                } else q++;
            }
            jb_put(out, "\nNote: reflects recorded violations only, not proof of changed behaviour.\n");
        }
        free(tmp.buf);
    } else if (strcmp(kind, "driver") == 0) {
        int did = atoi(arg ? arg : "0");
        Jb d;
        jb_init(&d);
        build_driver_detail_json(db, did, &d);
        if (strcmp(d.buf, "null") == 0) { jb_put(out, "Driver not found"); free(d.buf); return; }
        char *p = d.buf;
        char *nm = strstr(p, "\"name\":");
        char *lic = strstr(p, "\"license_number\":");
        char *sc = strstr(p, "\"score\":");
        char *lv = strstr(p, "\"level\":");
        char *tr = strstr(p, "\"trend\":");
        char name[96]="-", ln[48]="-";
        if (nm) { const char *s=nm+7; if(*s=='"'){s++; const char *e=strchr(s,'"'); size_t z= e? (size_t)(e-s):0; if(z>95)z=95; memcpy(name,s,z); name[z]=0; } }
        if (lic) { const char *s=lic+16; if(*s=='"'){s++; const char *e=strchr(s,'"'); size_t z= e? (size_t)(e-s):0; if(z>47)z=47; memcpy(ln,s,z); ln[z]=0; } }
        jb_putf(out, "Driver: %s (%s)\n", name, ln);
        jb_put(out, "Risk: ");
        if (sc) jb_putf(out, "%s/100 ", sc+7);
        if (lv) jb_put(out, lv+8);
        jb_put(out, "\nFactors: ");
        if (strstr(p, "\"factors\":") ) {
            char *f = strstr(p, "\"factors\":");
            char *fe = strchr(f, '}');
            if (fe) { *fe = 0; jb_put(out, f + 10); *fe = '}'; }
        }
        jb_put(out, "\nTrend (recorded): ");
        if (tr) { char *te = strchr(tr+10, '"'); if (te) { size_t z=(size_t)(te-(tr+10)); char tv[32]={0}; if(z>31)z=31; memcpy(tv,tr+10,z); jb_put(out, tv); } }
        jb_put(out, "\n\nHistory:\n");
        /* violations list from JSON */
        char *vl = strstr(p, "\"violations\":[");
        if (vl) {
            char *q = vl + strlen("\"violations\":[");
            while (q && *q && *q != ']') {
                if (*q == '{') {
                    char *cl = strchr(q, '}'); if (!cl) break;
                    char *fdate=strstr(q,"\"violation_date\":"), *ftime=strstr(q,"\"violation_time\":"),
                         *ftype=strstr(q,"\"violation_type\":"), *floc=strstr(q,"\"location\":"),
                         *ffine=strstr(q,"\"fine_amount\":"), *fpay=strstr(q,"\"payment_status\":");
                    char date[12]="-",time[8]="-",ty[32]="-",loc[48]="-",pay[12]="-";
                    long fine=0;
                    #define JEXTRACT(dst, find, pre) do { const char *s=(find)+pre; if(*s=='"'){s++; const char *e=strchr(s,'"'); if(e){size_t z=(size_t)(e-s); if(z>sizeof(dst)-1)z=sizeof(dst)-1; memcpy(dst,s,z); dst[z]=0;}} } while(0)
                    JEXTRACT(date, fdate, 15);
                    JEXTRACT(time, ftime, 15);
                    JEXTRACT(ty,   ftype, 16);
                    JEXTRACT(loc,  floc, 10);
                    JEXTRACT(pay,  fpay, 15);
                    if (ffine) fine = atol(ffine + 13);
                    jb_putf(out, "  %s %s %s @ %s Rs.%ld %s\n", date, time, ty, loc, fine, pay);
                    q = cl + 1;
                    if (*q == ',') q++;
                } else q++;
            }
        }
        free(d.buf);
    } else if (strcmp(kind, "csv") == 0) {
        jb_put(out, "violation_id,driver_id,vehicle_id,type,location,date,time,severity,fine,status\n");
        sqlite3_stmt *st = NULL;
        if (sqlite3_prepare_v2(db, "select * from violations order by violation_date desc", -1, &st, NULL) == SQLITE_OK) {
            while (sqlite3_step(st) == SQLITE_ROW) {
                jb_putf(out, "%d,%d,%d,%s,%s,%s,%s,%s,%d,%s\n",
                        sqlite3_column_int(st,0), sqlite3_column_int(st,1), sqlite3_column_int(st,2),
                        (const char *)sqlite3_column_text(st,4),
                        (const char *)sqlite3_column_text(st,5),
                        (const char *)sqlite3_column_text(st,6),
                        (const char *)sqlite3_column_text(st,7),
                        (const char *)sqlite3_column_text(st,8),
                        sqlite3_column_int(st,9),
                        (const char *)sqlite3_column_text(st,10));
            }
            sqlite3_finalize(st);
        }
    }
    free(a.buf);
}

/* ============================================================================
 * DATABASE SEEDER (deterministic, 150 drivers / 150 vehicles / synthetic violations)
 * ==========================================================================*/

static void seed_database(sqlite3 *db) {
    sqlite3_stmt *st = NULL;
    char sql_create[1024];
    int i;
    char nowbuf[24];
    now_str(nowbuf, sizeof(nowbuf));

    sqlite3_exec(db,
        "create table if not exists users(user_id integer primary key autoincrement,name text,username text unique,password_hash text,role text,created_at text);"
        "create table if not exists drivers(driver_id integer primary key,name text,license_number text unique,phone text,address text,created_at text);"
        "create table if not exists vehicles(vehicle_id integer primary key,vehicle_number text unique,vehicle_type text,model text,driver_id integer,registration_status text,created_at text);"
        "create table if not exists violations(violation_id integer primary key,driver_id integer,vehicle_id integer,officer_id integer,violation_type text,location text,violation_date text,violation_time text,severity text,fine_amount integer,payment_status text,evidence_reference text,created_at text);"
        "create table if not exists alerts(alert_id integer primary key autoincrement,driver_id integer,alert_type text,message text,severity text,created_at text,status text);",
        NULL, NULL, NULL);

    /* skip if already seeded */
    sqlite3_prepare_v2(db, "select count(*) from users", -1, &st, NULL);
    if (sqlite3_step(st) == SQLITE_ROW && sqlite3_column_int(st, 0) > 0) { sqlite3_finalize(st); return; }
    sqlite3_finalize(st);

    printf("Seeding demo database with synthetic traffic records...\n");

    char *admin_hash = hpw("admin123");
    char *officer_hash = hpw("officer123");
    sqlite3_prepare_v2(db,
        "insert into users(name,username,password_hash,role,created_at) values(?,?,?,?,?)", -1, &st, NULL);
    sqlite3_bind_text(st, 1, "Admin Office", -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(st, 2, "admin", -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(st, 3, admin_hash, -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(st, 4, "Administrator", -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(st, 5, nowbuf, -1, SQLITE_TRANSIENT);
    sqlite3_step(st);
    sqlite3_finalize(st);
    sqlite3_prepare_v2(db,
        "insert into users(name,username,password_hash,role,created_at) values(?,?,?,?,?)", -1, &st, NULL);
    sqlite3_bind_text(st, 1, "Officer Kavya", -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(st, 2, "officer", -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(st, 3, officer_hash, -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(st, 4, "Traffic Officer", -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(st, 5, nowbuf, -1, SQLITE_TRANSIENT);
    sqlite3_step(st);
    sqlite3_finalize(st);
    free(admin_hash);
    free(officer_hash);

    Rng r;
    rng_seed(&r, 7);

    /* drivers + vehicles */
    sqlite3_prepare_v2(db,
        "insert into drivers(driver_id,name,license_number,phone,address,created_at) values(?,?,?,?,?,?)", -1, &st, NULL);
    for (i = 1; i <= 150; i++) {
        char name[96], lic[48], phone[16], addr[128], dstr[16];
        minus_days_str(dstr, sizeof(dstr), 400 + rng_int(&r, 300));
        snprintf(name, sizeof(name), "%s %s",
                 G_FIRST[rng_int(&r, G_FIRST_N)], G_LAST[rng_int(&r, G_LAST_N)]);
        snprintf(lic, sizeof(lic), "TN%d%d%d", 10 + rng_int(&r, 90), 2010 + i % 14, 100000 + rng_int(&r, 900000));
        snprintf(phone, sizeof(phone), "9%09d", rng_int(&r, 1000000000));
        snprintf(addr, sizeof(addr), "%d, %s", 1 + rng_int(&r, 99), G_LOCS[rng_int(&r, G_LOCS_N)]);
        sqlite3_bind_int(st, 1, i);
        sqlite3_bind_text(st, 2, name, -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(st, 3, lic, -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(st, 4, phone, -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(st, 5, addr, -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(st, 6, dstr, -1, SQLITE_TRANSIENT);
        sqlite3_step(st);
        sqlite3_reset(st);
    }
    sqlite3_finalize(st);

    sqlite3_prepare_v2(db,
        "insert into vehicles(vehicle_id,vehicle_number,vehicle_type,model,driver_id,registration_status,created_at) values(?,?,?,?,?,?,?)", -1, &st, NULL);
    for (i = 1; i <= 150; i++) {
        int vt = rng_int(&r, G_VMODEL_N);
        char vnum[32], vdate[16];
        minus_days_str(vdate, sizeof(vdate), 200 + rng_int(&r, 600));
        snprintf(vnum, sizeof(vnum), "TN %d %c%c %d", 10 + rng_int(&r, 90),
                 'A' + rng_int(&r, 8), 'K' + rng_int(&r, 6), 1000 + rng_int(&r, 9000));
        sqlite3_bind_int(st, 1, i);
        sqlite3_bind_text(st, 2, vnum, -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(st, 3, G_VMODEL[vt][0], -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(st, 4, G_VMODEL[vt][1], -1, SQLITE_TRANSIENT);
        sqlite3_bind_int(st, 5, i);
        sqlite3_bind_text(st, 6, "Active", -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(st, 7, vdate, -1, SQLITE_TRANSIENT);
        sqlite3_step(st);
        sqlite3_reset(st);
    }
    sqlite3_finalize(st);

    /* violations */
    int hours_pool[] = {8,9,9,10,13,15,17,18,18,19,19,20,22};
    const char *statuses[] = {"Paid","Paid","Pending"};
    int vid = 0;
    sqlite3_prepare_v2(db,
        "insert into violations(violation_id,driver_id,vehicle_id,officer_id,violation_type,location,violation_date,violation_time,severity,fine_amount,payment_status,evidence_reference,created_at) "
        "values(?,?,?,?,?,?,?,?,?,?,?,?,?)", -1, &st, NULL);
    for (i = 1; i <= 150; i++) {
        double k = rng_double(&r);
        int n = k < 0.55 ? rng_int(&r, 4)
              : (k < 0.90 ? 3 + rng_int(&r, 5) : 8 + rng_int(&r, 7));
        const char *fav = G_TYPES[rng_int(&r, G_TYPES_N)].type;
        int j;
        for (j = 0; j < n; j++) {
            const char *ty;
            if ((n > 7 && rng_double(&r) < 0.6) || rng_double(&r) < 0.3) {
                ty = fav;
            } else {
                ty = G_TYPES[rng_int(&r, G_TYPES_N)].type;
            }
            double mode = n > 7 ? 8.0 : 90.0;
            int days = (int)triangular(&r, 1.0, 240.0, mode);
            char dstr[16], tstr[8], evref[32];
            minus_days_str(dstr, sizeof(dstr), days);
            int h = rng_double(&r) < 0.8 ? hours_pool[rng_int(&r, 13)] : rng_int(&r, 24);
            int m = rng_int(&r, 60);
            snprintf(tstr, sizeof(tstr), "%02d:%02d", h, m);
            ViolationRule *rule = NULL;
            int ti;
            for (ti = 0; ti < G_TYPES_N; ti++) if (strcmp(G_TYPES[ti].type, ty) == 0) { rule = &G_TYPES[ti]; break; }
            vid++;
            snprintf(evref, sizeof(evref), "EV-%05d", vid);
            sqlite3_bind_int(st, 1, vid);
            sqlite3_bind_int(st, 2, i);
            sqlite3_bind_int(st, 3, i);
            sqlite3_bind_int(st, 4, 1 + rng_int(&r, 2));
            sqlite3_bind_text(st, 5, ty, -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 6, G_LOCS[rng_int(&r, G_LOCS_N)], -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 7, dstr, -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 8, tstr, -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 9, rule ? rule->severity : "Minor", -1, SQLITE_TRANSIENT);
            sqlite3_bind_int(st, 10, rule ? rule->fine : 500);
            sqlite3_bind_text(st, 11, statuses[rng_int(&r, 3)], -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 12, evref, -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 13, nowbuf, -1, SQLITE_TRANSIENT);
            sqlite3_step(st);
            sqlite3_reset(st);
        }
    }
    sqlite3_finalize(st);

    /* initial alerts */
    for (i = 1; i <= 150; i++) refresh_alerts(db, i);

    printf("Seeding completed: %d violations generated.\n", vid);
}

/* ============================================================================
 * HTTP: QUERY + JSON BODY PARSERS
 * ==========================================================================*/

typedef struct { char k[64]; char v[256]; } KV;

static int url_decode(char *s) {
    char *r = s;
    while (*s) {
        if (*s == '%' && isxdigit((unsigned char)s[1]) && isxdigit((unsigned char)s[2])) {
            int hi = isdigit((unsigned char)s[1]) ? s[1]-'0' : tolower(s[1])-'a'+10;
            int lo = isdigit((unsigned char)s[2]) ? s[2]-'0' : tolower(s[2])-'a'+10;
            *r++ = (char)((hi << 4) | lo);
            s += 3;
        } else if (*s == '+') {
            *r++ = ' ';
            s++;
        } else {
            *r++ = *s++;
        }
    }
    *r = 0;
    return (int)(r - s);
}

static int parse_query(const char *q, KV *out, int max) {
    int n = 0;
    char *copy, *p, *next;
    if (!q || !*q) return 0;
    copy = xstrdup(q);
    p = copy;
    while (p && n < max) {
        next = strchr(p, '&');
        if (next) *next = 0;
        {
            char *eq = strchr(p, '=');
            if (eq) {
                *eq = 0;
                url_decode(p);
                url_decode(eq + 1);
                strncpy(out[n].k, p, sizeof(out[n].k)-1);
                strncpy(out[n].v, eq + 1, sizeof(out[n].v)-1);
            } else {
                url_decode(p);
                strncpy(out[n].k, p, sizeof(out[n].k)-1);
                out[n].v[0] = 0;
            }
            n++;
        }
        p = next ? next + 1 : NULL;
    }
    free(copy);
    return n;
}

static const KV *query_get(const KV *kv, int n, const char *key) {
    int i;
    for (i = 0; i < n; i++) if (strcmp(kv[i].k, key) == 0) return &kv[i];
    return NULL;
}

/* Extract a flattened JSON string value: {...,"key":"value",...} */
static int json_get_str(const char *json, const char *key, char *out, size_t sz) {
    char pat[64];
    const char *p;
    snprintf(pat, sizeof(pat), "\"%s\"", key);
    p = strstr(json, pat);
    if (!p) return 0;
    p += strlen(pat);
    while (*p && *p != ':') p++;
    if (*p != ':') return 0;
    p++;
    while (*p && isspace((unsigned char)*p)) p++;
    if (*p != '"') return 0;
    p++;
    {
        size_t i = 0;
        while (*p && *p != '"' && i + 1 < sz) {
            if (*p == '\\' && *(p+1)) p++;
            out[i++] = *p++;
        }
        out[i] = 0;
    }
    return 1;
}

/* ============================================================================
 * HTTP SERVER
 * ==========================================================================*/

typedef struct {
    int    status;
    char  *body;
    char   ctype[32];
} HttpResponse;

static void resp_json(HttpResponse *r, int status, Jb *b) {
    r->status = status;
    r->body = b->buf;
    strcpy(r->ctype, "application/json");
    b->buf = NULL; /* ownership transferred */
}

static void resp_text(HttpResponse *r, int status, Jb *b, const char *ctype) {
    r->status = status;
    r->body = b->buf;
    strncpy(r->ctype, ctype, sizeof(r->ctype)-1);
    b->buf = NULL;
}

static void send_json_error(HttpResponse *r, int status, const char *msg) {
    Jb b;
    jb_init(&b);
    jb_put(&b, "{\"error\":");
    jb_json_str(&b, msg);
    jb_putc(&b, '}');
    resp_json(r, status, &b);
}

/* Auth: parse "Bearer <token>" from request headers. */
static Session *authenticated(const char *headers) {
    const char *h = strstr(headers, "Authorization:");
    if (!h) h = strstr(headers, "authorization:");
    if (!h) return NULL;
    const char *t = strchr(h, ':');
    if (!t) return NULL;
    t++;
    while (*t == ' ') t++;
    if (strncmp(t, "Bearer ", 7) != 0) return NULL;
    t += 7;
    char token[40];
    int i;
    for (i = 0; i < 39 && t[i] && t[i] != '\r' && t[i] != '\n'; i++) token[i] = t[i];
    token[i] = 0;
    return session_by_token(token);
}

/* Main router. */
static void handle_request(sqlite3 *db, const char *method, const char *path,
                           const char *query, const char *body, const char *headers,
                           HttpResponse *resp) {
    int is_post = strcmp(method, "POST") == 0;
    Jb b;

    /* non-API: serve index.html if present */
    if (strncmp(path, "/api", 4) != 0) {
        FILE *f = fopen("index.html", "rb");
        if (f) {
            Jb b2;
            jb_init(&b2);
            char chunk[4096];
            size_t rd;
            while ((rd = fread(chunk, 1, sizeof(chunk), f)) > 0) { jb_grow(&b2, rd); memcpy(b2.buf + b2.len, chunk, rd); b2.len += rd; b2.buf[b2.len] = 0; }
            fclose(f);
            resp->status = 200;
            resp->body = b2.buf;
            strcpy(resp->ctype, "text/html");
            b2.buf = NULL;
        } else {
            jb_init(&b);
            jb_put(&b, "Roadwise Traffic Backend (C) running.");
            resp_text(resp, 200, &b, "text/plain");
        }
        return;
    }

    if (is_post && strcmp(path, "/api/login") == 0) {
        char username[64] = "", password[64] = "";
        json_get_str(body ? body : "", "username", username, sizeof(username));
        json_get_str(body ? body : "", "password", password, sizeof(password));
        sqlite3_stmt *st = NULL;
        if (sqlite3_prepare_v2(db, "select * from users where username=?", -1, &st, NULL) != SQLITE_OK) {
            send_json_error(resp, 500, "db error");
            return;
        }
        sqlite3_bind_text(st, 2 > 0 ? 1 : 1, username, -1, SQLITE_TRANSIENT);
        if (sqlite3_step(st) == SQLITE_ROW) {
            const char *hash = (const char *)sqlite3_column_text(st, 3);
            if (chk_password(password, hash)) {
                char token[40];
                gen_token(token);
                const char *name = (const char *)sqlite3_column_text(st, 1);
                const char *role = (const char *)sqlite3_column_text(st, 4);
                session_add(token, sqlite3_column_int(st, 0), name, role);
                jb_init(&b);
                jb_put(&b, "{\"token\":");
                jb_json_str(&b, token);
                jb_put(&b, ",\"user\":{");
                jb_putf(&b, "\"id\":%d,", sqlite3_column_int(st, 0));
                jb_put(&b, "\"name\":"); jb_json_str(&b, name); jb_putc(&b, ',');
                jb_put(&b, "\"role\":"); jb_json_str(&b, role);
                jb_put(&b, "}}");
                resp_json(resp, 200, &b);
                sqlite3_finalize(st);
                return;
            }
        }
        sqlite3_finalize(st);
        send_json_error(resp, 401, "Wrong username or password");
        return;
    }

    if (strcmp(path, "/api/public") == 0) {
        Jb a;
        jb_init(&a);
        build_analytics_json(db, &a);
        /* extract 4 scalar stats from the analytics JSON */
        long violations = 0, drivers = 0, hotspots = 0, high_risk = 0;
        char *h = a.buf;
        char *p;
        if ((p = strstr(h, "\"violations\":"))) violations = atol(p + 13);
        if ((p = strstr(h, "\"drivers\":"))) drivers = atol(p + 10);
        if ((p = strstr(h, "\"hotspots\":"))) hotspots = atol(p + 11);
        if ((p = strstr(h, "\"high_risk\":"))) high_risk = atol(p + 12);
        jb_init(&b);
        jb_putf(&b, "{\"violations\":%ld,\"drivers\":%ld,\"hotspots\":%ld,\"high_risk\":%ld}",
                violations, drivers, hotspots, high_risk);
        resp_json(resp, 200, &b);
        free(a.buf);
        return;
    }

    Session *me = authenticated(headers);
    if (!me) { send_json_error(resp, 401, "Please sign in"); return; }

    if (strcmp(path, "/api/analytics") == 0) {
        jb_init(&b);
        build_analytics_json(db, &b);
        resp_json(resp, 200, &b);
        return;
    }

    if (strcmp(path, "/api/drivers") == 0) {
        KV kv[16];
        int n = parse_query(query, kv, 16);
        const KV *q = query_get(kv, n, "q");
        const char *needle = q ? q->v : "";
        char like[400];
        snprintf(like, sizeof(like), "%%%s%%", needle);
        sqlite3_stmt *st = NULL;
        /* collect -> score -> sort -> top 60 */
        struct DRow { int id; char name[96]; char lic[48]; char vnum[32]; int score; char level[16]; int total; } rows[200];
        int nr = 0;
        if (sqlite3_prepare_v2(db,
                "select d.driver_id, d.name, d.license_number, ve.vehicle_number "
                "from drivers d left join vehicles ve on ve.driver_id=d.driver_id "
                "where d.name like ? or d.license_number like ? or ve.vehicle_number like ?",
                -1, &st, NULL) == SQLITE_OK) {
            sqlite3_bind_text(st, 1, like, -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 2, like, -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 3, like, -1, SQLITE_TRANSIENT);
            while (sqlite3_step(st) == SQLITE_ROW && nr < 200) {
                int did = sqlite3_column_int(st, 0);
                Violation *vs = NULL;
                int nv = load_violations_for_driver(db, did, &vs);
                RiskResult r = calculate_risk(vs, nv);
                struct DRow *row = &rows[nr++];
                row->id = did;
                strncpy(row->name, (const char *)sqlite3_column_text(st, 1), sizeof(row->name)-1);
                strncpy(row->lic,  (const char *)sqlite3_column_text(st, 2), sizeof(row->lic)-1);
                strncpy(row->vnum, (const char *)sqlite3_column_text(st, 3), sizeof(row->vnum)-1);
                row->score = r.score;
                strncpy(row->level, r.level, sizeof(row->level)-1);
                row->total = r.total;
                free(vs);
            }
            sqlite3_finalize(st);
        }
        /* sort by score desc */
        int a2, b2;
        for (a2 = 0; a2 < nr; a2++)
            for (b2 = a2 + 1; b2 < nr; b2++)
                if (rows[b2].score > rows[a2].score) {
                    struct DRow t = rows[a2]; rows[a2] = rows[b2]; rows[b2] = t;
                }
        if (nr > 60) nr = 60;
        jb_init(&b);
        jb_putc(&b, '[');
        for (a2 = 0; a2 < nr; a2++) {
            if (a2) jb_putc(&b, ',');
            jb_putc(&b, '{');
            jb_putf(&b, "\"driver_id\":%d,", rows[a2].id);
            jb_put(&b, "\"name\":"); jb_json_str(&b, rows[a2].name); jb_putc(&b, ',');
            jb_put(&b, "\"license_number\":"); jb_json_str(&b, rows[a2].lic); jb_putc(&b, ',');
            jb_put(&b, "\"vehicle_number\":"); jb_json_str(&b, rows[a2].vnum); jb_putc(&b, ',');
            jb_putf(&b, "\"score\":%d,", rows[a2].score);
            jb_put(&b, "\"level\":"); jb_json_str(&b, rows[a2].level); jb_putc(&b, ',');
            jb_putf(&b, "\"total\":%d", rows[a2].total);
            jb_putc(&b, '}');
        }
        jb_putc(&b, ']');
        resp_json(resp, 200, &b);
        return;
    }

    if (strncmp(path, "/api/drivers/", 13) == 0) {
        int did = atoi(path + 13);
        jb_init(&b);
        build_driver_detail_json(db, did, &b);
        if (strcmp(b.buf, "null") == 0) {
            free(b.buf);
            send_json_error(resp, 404, "Not found");
            return;
        }
        resp_json(resp, 200, &b);
        return;
    }

    if (is_post && strcmp(path, "/api/violations") == 0) {
        char vehicle_number[32] = "", vtype[32] = "", loc[48] = "", vdate[16] = "", vtime[8] = "", evidence[96] = "";
        json_get_str(body ? body : "", "vehicle_number", vehicle_number, sizeof(vehicle_number));
        json_get_str(body ? body : "", "violation_type", vtype, sizeof(vtype));
        json_get_str(body ? body : "", "location", loc, sizeof(loc));
        json_get_str(body ? body : "", "violation_date", vdate, sizeof(vdate));
        json_get_str(body ? body : "", "violation_time", vtime, sizeof(vtime));
        json_get_str(body ? body : "", "evidence", evidence, sizeof(evidence));

        /* uppercase vehicle number */
        { char *p2 = vehicle_number; for (; *p2; p2++) *p2 = (char)toupper((unsigned char)*p2); }

        int veh_id = 0, driver_id = 0;
        sqlite3_stmt *st = NULL;
        if (sqlite3_prepare_v2(db, "select * from vehicles where upper(vehicle_number)=?", -1, &st, NULL) == SQLITE_OK) {
            sqlite3_bind_text(st, 1, vehicle_number, -1, SQLITE_TRANSIENT);
            if (sqlite3_step(st) == SQLITE_ROW) {
                veh_id = sqlite3_column_int(st, 0);
                driver_id = sqlite3_column_int(st, 4);
            }
            sqlite3_finalize(st);
        }
        if (veh_id == 0) { send_json_error(resp, 400, "Vehicle number not found. Check the registration number."); return; }

        ViolationRule *rule = NULL;
        int ti;
        int loc_ok = 0;
        for (ti = 0; ti < G_TYPES_N; ti++) if (strcmp(G_TYPES[ti].type, vtype) == 0) { rule = &G_TYPES[ti]; break; }
        for (ti = 0; ti < G_LOCS_N; ti++) if (strcmp(G_LOCS[ti], loc) == 0) { loc_ok = 1; break; }
        if (!rule) { send_json_error(resp, 400, "Choose a violation type"); return; }
        if (!loc_ok) { send_json_error(resp, 400, "Choose a location"); return; }
        {
            int y=0, mo=0, dd=0, hh=0, mi=0;
            if (sscanf(vdate, "%d-%d-%d", &y, &mo, &dd) != 3) { send_json_error(resp, 400, "Enter a valid date and time"); return; }
            if (sscanf(vtime, "%d:%d", &hh, &mi) != 2) { send_json_error(resp, 400, "Enter a valid date and time"); return; }
        }

        Violation *vs = NULL;
        int nv = load_violations_for_driver(db, driver_id, &vs);
        int before = calculate_risk(vs, nv).score;
        free(vs);

        char nowbuf[24];
        now_str(nowbuf, sizeof(nowbuf));
        if (sqlite3_prepare_v2(db,
                "insert into violations(driver_id,vehicle_id,officer_id,violation_type,location,violation_date,violation_time,severity,fine_amount,payment_status,evidence_reference,created_at) "
                "values(?,?,?,?,?,?,?,?,?,?,?,?)", -1, &st, NULL) == SQLITE_OK) {
            sqlite3_bind_int(st, 1, driver_id);
            sqlite3_bind_int(st, 2, veh_id);
            sqlite3_bind_int(st, 3, me->id);
            sqlite3_bind_text(st, 4, vtype, -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 5, loc, -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 6, vdate, -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 7, vtime, -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 8, rule->severity, -1, SQLITE_TRANSIENT);
            sqlite3_bind_int(st, 9, rule->fine);
            sqlite3_bind_text(st, 10, "Pending", -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 11, evidence[0] ? evidence : "", -1, SQLITE_TRANSIENT);
            sqlite3_bind_text(st, 12, nowbuf, -1, SQLITE_TRANSIENT);
            sqlite3_step(st);
            sqlite3_finalize(st);
        }

        int new_alerts = refresh_alerts(db, driver_id);
        vs = NULL;
        nv = load_violations_for_driver(db, driver_id, &vs);
        RiskResult after = calculate_risk(vs, nv);
        free(vs);

        jb_init(&b);
        jb_putf(&b, "{\"driver_id\":%d,", driver_id);
        jb_putf(&b, "\"fine\":%d,", rule->fine);
        jb_put(&b, "\"severity\":"); jb_json_str(&b, rule->severity); jb_putc(&b, ',');
        jb_putf(&b, "\"before\":%d,", before);
        jb_putf(&b, "\"after\":%d,", after.score);
        jb_put(&b, "\"level\":"); jb_json_str(&b, after.level); jb_putc(&b, ',');
        jb_putf(&b, "\"new_alerts\":%d,", new_alerts);
        jb_put(&b, "\"patterns\":[");
        {
            int pi;
            for (pi = 0; pi < after.npatterns; pi++) {
                if (pi) jb_putc(&b, ',');
                jb_putc(&b, '{');
                jb_put(&b, "\"kind\":"); jb_json_str(&b, after.patterns[pi].kind); jb_putc(&b, ',');
                jb_put(&b, "\"text\":"); jb_json_str(&b, after.patterns[pi].text);
                jb_putc(&b, '}');
            }
        }
        jb_putc(&b, ']');
        jb_putc(&b, '}');
        resp_json(resp, 200, &b);
        return;
    }

    if (strcmp(path, "/api/alerts") == 0) {
        /* ---- Smart Alert Prioritization (binary Heap + Comparator) ---- */
        AlertHeap heap;
        heap_init(&heap, 32);
        sqlite3_stmt *st = NULL;

        if (sqlite3_prepare_v2(db,
                "select a.alert_id, a.driver_id, d.name, a.alert_type, a.message, a.severity, a.created_at, a.status "
                "from alerts a join drivers d on d.driver_id=a.driver_id order by a.alert_id desc limit 150",
                -1, &st, NULL) == SQLITE_OK) {
            while (sqlite3_step(st) == SQLITE_ROW) {
                AlertItem ai;
                memset(&ai, 0, sizeof(ai));
                ai.alert_id = sqlite3_column_int(st, 0);
                ai.driver_id = sqlite3_column_int(st, 1);
                strncpy(ai.driver_name, (const char *)sqlite3_column_text(st, 2), sizeof(ai.driver_name)-1);
                strncpy(ai.alert_type, (const char *)sqlite3_column_text(st, 3), sizeof(ai.alert_type)-1);
                strncpy(ai.message,    (const char *)sqlite3_column_text(st, 4), sizeof(ai.message)-1);
                strncpy(ai.severity,   (const char *)sqlite3_column_text(st, 5), sizeof(ai.severity)-1);
                strncpy(ai.created_at, (const char *)sqlite3_column_text(st, 6), sizeof(ai.created_at)-1);
                strncpy(ai.status,     (const char *)sqlite3_column_text(st, 7), sizeof(ai.status)-1);

                Violation *vs = NULL;
                int nv = load_violations_for_driver(db, ai.driver_id, &vs);
                RiskResult rr = calculate_risk(vs, nv);
                free(vs);
                ai.risk_score = rr.score;
                ai.urgency = urgency_score(ai.created_at, strcmp(ai.status, "Reviewed") != 0);
                ai.priority = alert_priority(ai.severity, ai.risk_score, ai.urgency);
                strncpy(ai.priority_label, priority_label(ai.priority), sizeof(ai.priority_label)-1);
                heap_push(&heap, &ai);
            }
            sqlite3_finalize(st);
        }

        /* dynamic location hotspot alerts join the same heap */
        Jb an;
        jb_init(&an);
        build_analytics_json(db, &an);
        {
            char *p = an.buf, *end = an.buf + an.len;
            char *loc = strstr(p, "\"by_location\":[");
            if (loc) {
                char *q = loc + strlen("\"by_location\":[");
                while (q && q < end) {
                    char *ob = strchr(q, '{');
                    if (!ob) break;
                    char *cl = strchr(ob, '}');
                    if (!cl) break;
                    *cl = 0;
                    int hotspot = strstr(ob, "\"hotspot\":true") != NULL;
                    if (hotspot) {
                        char locname[96] = "-", topt[64] = "-";
                        char *fname = strstr(ob, "\"location\":"), *fcnt = strstr(ob, "\"count\":"), *ftop = strstr(ob, "\"top_type\":");
                        long cnt = 0;
                        if (fname) { const char *s = fname + 11; if (*s == '"') { s++; const char *e = strchr(s, '"'); if (e) { size_t z = (size_t)(e-s); if (z>95) z=95; memcpy(locname, s, z); locname[z] = 0; } } }
                        if (fcnt) cnt = atol(fcnt + 7);
                        if (ftop) { const char *s = ftop + 10; if (*s == '"') { s++; const char *e = strchr(s, '"'); if (e) { size_t z = (size_t)(e-s); if (z>63) z=63; memcpy(topt, s, z); topt[z] = 0; } } }
                        AlertItem ai;
                        char nowbuf[24];
                        memset(&ai, 0, sizeof(ai));
                        now_str(nowbuf, sizeof(nowbuf));
                        ai.alert_id = 0;
                        ai.driver_id = 0;
                        strncpy(ai.driver_name, locname, sizeof(ai.driver_name)-1);
                        strcpy(ai.alert_type, "Location Hotspot");
                        strncpy(ai.severity, "Medium", sizeof(ai.severity)-1);
                        strcpy(ai.status, "Info");
                        strncpy(ai.created_at, nowbuf, sizeof(ai.created_at)-1);
                        snprintf(ai.message, sizeof(ai.message),
                                 "%s has %ld recorded violations, above the hotspot threshold. Most common: %s.",
                                 locname, cnt, topt);
                        ai.risk_score = 0;
                        ai.urgency = urgency_score(ai.created_at, 1);
                        ai.priority = alert_priority(ai.severity, ai.risk_score, ai.urgency);
                        strncpy(ai.priority_label, priority_label(ai.priority), sizeof(ai.priority_label)-1);
                        heap_push(&heap, &ai);
                    }
                    *cl = '}';
                    q = cl + 2;
                    if (*q != ',' && *q != ']') break;
                }
            }
        }
        free(an.buf);

        /* drain the heap: most important alert first */
        jb_init(&b);
        jb_putc(&b, '[');
        {
            int first = 1;
            AlertItem *it;
            while ((it = heap_pop(&heap)) != NULL) {
                if (!first) jb_putc(&b, ',');
                first = 0;
                jb_putc(&b, '{');
                jb_putf(&b, "\"alert_id\":%d,", it->alert_id);
                jb_putf(&b, "\"driver_id\":%d,", it->driver_id);
                jb_put(&b, "\"driver_name\":"); jb_json_str(&b, it->driver_name); jb_putc(&b, ',');
                jb_put(&b, "\"alert_type\":"); jb_json_str(&b, it->alert_type); jb_putc(&b, ',');
                jb_put(&b, "\"message\":"); jb_json_str(&b, it->message); jb_putc(&b, ',');
                jb_put(&b, "\"severity\":"); jb_json_str(&b, it->severity); jb_putc(&b, ',');
                jb_put(&b, "\"created_at\":"); jb_json_str(&b, it->created_at); jb_putc(&b, ',');
                jb_put(&b, "\"status\":"); jb_json_str(&b, it->status); jb_putc(&b, ',');
                jb_putf(&b, "\"priority\":%d,", it->priority);
                jb_put(&b, "\"priority_label\":"); jb_json_str(&b, it->priority_label); jb_putc(&b, ',');
                jb_putf(&b, "\"risk_score\":%d,", it->risk_score);
                jb_putf(&b, "\"urgency\":%d", it->urgency);
                jb_putc(&b, '}');
            }
        }
        jb_putc(&b, ']');
        free(heap.items);
        resp_json(resp, 200, &b);
        return;
    }

    if (is_post && strncmp(path, "/api/alerts/", 12) == 0 && strcmp(path + strlen(path) - 4, "/ack") == 0) {
        int aid = atoi(path + 12);
        sqlite3_stmt *st = NULL;
        sqlite3_prepare_v2(db, "update alerts set status='Reviewed' where alert_id=?", -1, &st, NULL);
        sqlite3_bind_int(st, 1, aid);
        sqlite3_step(st);
        sqlite3_finalize(st);
        jb_init(&b);
        jb_put(&b, "{\"ok\":true}");
        resp_json(resp, 200, &b);
        return;
    }

    if (strcmp(path, "/api/whatif") == 0) {
        KV kv[16];
        int n = parse_query(query, kv, 16);
        const KV *sc_kv = query_get(kv, n, "scenario");
        const KV *loc_kv = query_get(kv, n, "location");
        int scen_idx = -1, i;
        for (i = 0; i < 3; i++) if (sc_kv && strcmp(sc_kv->v, G_SCEN_N[i]) == 0) { scen_idx = i; break; }
        if (scen_idx < 0 || !loc_kv) { send_json_error(resp, 400, "Choose a location and scenario"); return; }

        long baseline = 0;
        Jb an;
        jb_init(&an);
        build_analytics_json(db, &an);
        {
            char *p = an.buf, *end = an.buf + an.len;
            char *loc = strstr(p, "\"by_location\":[");
            if (loc) {
                char *q = loc + strlen("\"by_location\":[");
                while (q && q < end) {
                    char *ob = strchr(q, '{');
                    if (!ob) break;
                    char *cl = strchr(ob, '}');
                    if (!cl) break;
                    *cl = 0;
                    char locname[96] = "-";
                    char *fname = strstr(ob, "\"location\":"), *fcnt = strstr(ob, "\"count\":");
                    if (fname) { const char *s = fname + 11; if (*s == '"') { s++; const char *e = strchr(s, '"'); if (e) { size_t z = (size_t)(e-s); if (z>95) z=95; memcpy(locname, s, z); locname[z] = 0; } } }
                    if (strcmp(locname, loc_kv->v) == 0 && fcnt) { baseline = atol(fcnt + 7); }
                    *cl = '}';
                    q = cl + 2;
                    if (*q != ',' && *q != ']') break;
                }
            }
        }
        free(an.buf);
        if (baseline == 0) { send_json_error(resp, 400, "Choose a location and scenario"); return; }

        jb_init(&b);
        jb_put(&b, "{\"location\":"); jb_json_str(&b, loc_kv->v); jb_putc(&b, ',');
        jb_putf(&b, "\"baseline\":%ld,", baseline);
        jb_putf(&b, "\"low_pct\":%d,", G_SCEN_LO[scen_idx]);
        jb_putf(&b, "\"high_pct\":%d,", G_SCEN_HI[scen_idx]);
        jb_putf(&b, "\"est_low\":%ld,", (long)roundi(baseline * (1.0 - G_SCEN_HI[scen_idx] / 100.0)));
        jb_putf(&b, "\"est_high\":%ld,", (long)roundi(baseline * (1.0 - G_SCEN_LO[scen_idx] / 100.0)));
        jb_put(&b, "\"note\":\"Historical-data-based estimate; not a guaranteed prediction.\"");
        jb_putc(&b, '}');
        resp_json(resp, 200, &b);
        return;
    }

    if (strcmp(path, "/api/report") == 0) {
        KV kv[16];
        int n = parse_query(query, kv, 16);
        const KV *kind_q = query_get(kv, n, "kind");
        const KV *id_q = query_get(kv, n, "id");
        const char *kind = kind_q ? kind_q->v : "summary";
        jb_init(&b);
        generate_report(db, kind, id_q ? id_q->v : NULL, &b);
        const char *ctype = strcmp(kind, "csv") == 0 ? "text/csv" : "text/plain";
        resp_text(resp, 200, &b, ctype);
        return;
    }

    send_json_error(resp, 404, "Not found");
}

/* ---- connection handling ---- */

static void send_response(SOCKET c, int status, const char *ctype, const char *body) {
    char head[512];
    const char *status_text = "OK";
    if (status == 401) status_text = "Unauthorized";
    else if (status == 400) status_text = "Bad Request";
    else if (status == 404) status_text = "Not Found";
    else if (status == 500) status_text = "Internal Server Error";
    snprintf(head, sizeof(head),
             "HTTP/1.1 %d %s\r\n"
             "Content-Type: %s; charset=utf-8\r\n"
             "Access-Control-Allow-Origin: *\r\n"
             "Access-Control-Allow-Headers: Content-Type, Authorization\r\n"
             "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
             "Content-Length: %d\r\n"
             "Connection: close\r\n\r\n",
             status, status_text, ctype, (int)strlen(body));
    send(c, head, (int)strlen(head), 0);
    send(c, body, (int)strlen(body), 0);
}

typedef struct { SOCKET client; } ConnArgs;

static const char *find_hdr(const char *req, const char *name) {
    const char *p = req;
    size_t nlen = strlen(name);
    while ((p = strstr(p, name)) != NULL) {
        if (p == req || p[-1] == '\n') {
            const char *v = p + nlen;
            while (*v == ' ') v++;
            return v;
        }
        p += nlen;
    }
    return NULL;
}

static unsigned __stdcall conn_thread(void *arg) {
    ConnArgs *ca = (ConnArgs *)arg;
    SOCKET c = ca->client;
    free(ca);

    char *req = (char *)malloc(PAGE_MAX);
    size_t used = 0;
    int body_len = -1, header_end = -1;
    int done = 0;

    while (!done && used < PAGE_MAX - 1) {
        int r = recv(c, req + used, (int)(PAGE_MAX - 1 - used), 0);
        if (r <= 0) break;
        used += (size_t)r;
        req[used] = 0;
        if (header_end < 0) {
            char *sep = strstr(req, "\r\n\r\n");
            if (sep) {
                header_end = (int)(sep - req);
                const char *cl = find_hdr(req, "Content-Length:");
                body_len = cl ? atoi(cl) : 0;
                if (body_len < 0) body_len = 0;
            }
        }
        if (header_end >= 0 && used >= (size_t)(header_end + 4 + body_len)) done = 1;
    }

    HttpResponse resp;
    memset(&resp, 0, sizeof(resp));
    resp.status = 500;
    resp.body = NULL;
    strcpy(resp.ctype, "text/plain");

    if (used > 0) {
        char method[16] = "", path[512] = "", query[512] = "", version[16] = "";
        char *line_end = strstr(req, "\r\n");
        char *line = xstrndup(req, line_end ? (size_t)(line_end - req) : used);
        int parsed = sscanf(line, "%15s %511s %15s", method, path, version);
        if (parsed >= 2) {
            char *qmark = strchr(path, '?');
            if (qmark) {
                strncpy(query, qmark + 1, sizeof(query)-1);
                *qmark = 0;
            }
        }
        free(line);

        const char *body0 = (const char *)req + header_end + 4;
        sqlite3 *db = NULL;
        if (sqlite3_open(DB_PATH, &db) != SQLITE_OK) {
            jb_init(&(Jb){0});
            /* not reached normally */
        }
        if (!db) {
            static Jb eb;
            jb_init(&eb);
            jb_put(&eb, "{\"error\":\"db open failed\"}");
            resp_json(&resp, 500, &eb);
        } else if (strcmp(method, "OPTIONS") == 0) {
            resp.status = 204;
            resp.body = xstrdup("");
            strcpy(resp.ctype, "text/plain");
        } else {
            char *body = malloc((size_t)body_len + 1);
            if (body) {
                if (body_len > 0) memcpy(body, body0, (size_t)body_len);
                body[body_len] = 0;
                handle_request(db, method, path, query, body, req, &resp);
                free(body);
            }
        }
        if (db) sqlite3_close(db);
    }

    send_response(c, resp.status, resp.ctype, resp.body ? resp.body : "");
    closesocket(c);

    if (resp.body) free(resp.body);
    free(req);
    return 0;
}

/* ============================================================================
 * MAIN
 * ==========================================================================*/

int main(void) {
    WSADATA wsa;
    SOCKET sd;
    struct sockaddr_in addr;
    int port = PORT_DEFAULT;
    const char *port_env = getenv("PORT");

    srand((unsigned)time(NULL));
    InitializeCriticalSection(&g_sess_lock);

    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        fprintf(stderr, "WSAStartup failed\n");
        return 1;
    }

    /* seed / open database */
    sqlite3 *db = NULL;
    if (sqlite3_open(DB_PATH, &db) != SQLITE_OK) {
        fprintf(stderr, "Cannot open database %s: %s\n", DB_PATH, sqlite3_errmsg(db));
        return 1;
    }
    seed_database(db);
    sqlite3_close(db);

    if (port_env) {
        int p = atoi(port_env);
        if (p > 0 && p < 65536) port = p;
    }

    sd = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (sd == INVALID_SOCKET) {
        fprintf(stderr, "socket failed\n");
        return 1;
    }
    {
        int one = 1;
        setsockopt(sd, SOL_SOCKET, SO_REUSEADDR, (const char *)&one, sizeof(one));
    }
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons((unsigned short)port);
    if (bind(sd, (struct sockaddr *)&addr, sizeof(addr)) != 0) {
        fprintf(stderr, "bind failed on port %d\n", port);
        return 1;
    }
    if (listen(sd, 16) != 0) {
        fprintf(stderr, "listen failed\n");
        return 1;
    }

    printf("==================================================================\n");
    printf(" Roadwise Traffic Violation Prevention & Analytics Backend (C)\n");
    printf(" Running on: http://localhost:%d\n", port);
    printf(" Demo logins: admin / admin123  |  officer / officer123\n");
    printf(" SQLite Database: %s\n", DB_PATH);
    printf("==================================================================\n");

    for (;;) {
        SOCKET c = accept(sd, NULL, NULL);
        if (c == INVALID_SOCKET) continue;
        ConnArgs *ca = (ConnArgs *)malloc(sizeof(ConnArgs));
        ca->client = c;
        uintptr_t th = _beginthreadex(NULL, 0, conn_thread, ca, 0, NULL);
        if (th == 0) {
            closesocket(c);
            free(ca);
        } else {
            CloseHandle((HANDLE)th); /* detached */
        }
    }

    DeleteCriticalSection(&g_sess_lock);
    WSACleanup();
    return 0;
}