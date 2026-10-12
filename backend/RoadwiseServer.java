/**
 * Roadwise Backend - Smart Traffic Violation Prevention & Management (PRD v1.0).
 * 
 * Direct Java translation of Roadwise server.py.
 * Features:
 *  - Native Java HTTP Server (com.sun.net.httpserver.HttpServer) - no heavy framework required
 *  - SQLite database integration (traffic.db)
 *  - PBKDF2 HMAC-SHA256 password hashing (matching Python hashlib.pbkdf2_hmac)
 *  - Deterministic explainable risk engine (Frequency 30%, Recent 25%, Repeat 25%, Severity 20%)
 *  - Hotspot detection (1.25x average threshold) & temporal analytics
 *  - Rule-based pattern detection & automated alert engine
 *  - Smart Alert Prioritization (Heap / PriorityQueue + Comparator): every alert is
 *    scored from severity, driver risk and urgency, then drained priority-first
 *  - What-If scenario impact simulations
 *  - Automated demo database seeder (150 drivers, 150 vehicles, synthetic violations)
 *  - Plain text & CSV audit reporting
 * 
 * Quick Compilation & Run:
 *   javac -cp "sqlite-jdbc.jar;." RoadwiseServer.java
 *   java  -cp "sqlite-jdbc.jar;." RoadwiseServer
 * 
 * Demo Logins:
 *   admin   / admin123
 *   officer / officer123
 */

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.io.*;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.sql.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

public class RoadwiseServer {

    // =========================================================================
    // CONFIGURATION & CONSTANTS
    // =========================================================================
    private static final String BASE_DIR = System.getProperty("user.dir");
    private static final String DB_PATH = Paths.get(BASE_DIR, "traffic.db").toString();
    private static final String DB_URL = "jdbc:sqlite:" + DB_PATH;

    public static class ViolationRule {
        public final String severity;
        public final int fine;
        public ViolationRule(String severity, int fine) {
            this.severity = severity;
            this.fine = fine;
        }
    }

    // Prototype rules: type -> (severity, fine INR)
    public static final Map<String, ViolationRule> TYPES = new LinkedHashMap<>();
    static {
        TYPES.put("Overspeeding", new ViolationRule("Major", 1000));
        TYPES.put("Red Light Jumping", new ViolationRule("Severe", 1500));
        TYPES.put("No Helmet", new ViolationRule("Medium", 500));
        TYPES.put("No Seatbelt", new ViolationRule("Minor", 500));
        TYPES.put("Illegal Parking", new ViolationRule("Minor", 300));
        TYPES.put("Mobile Phone Use", new ViolationRule("Medium", 1000));
        TYPES.put("Wrong Side Driving", new ViolationRule("Major", 1000));
        TYPES.put("Drunk Driving", new ViolationRule("Severe", 5000));
    }

    public static final Map<String, Integer> SEV = Map.of(
            "Minor", 25,
            "Medium", 50,
            "Major", 75,
            "Severe", 100
    );

    /** Alert severity weights used by Smart Alert Prioritization (0-100 scale). */
    public static final Map<String, Integer> ALERT_SEV = Map.of(
            "Info", 10,
            "Low", 25,
            "Medium", 50,
            "High", 75,
            "Critical", 100
    );

    public static final List<String> LOCS = List.of(
            "Anna Nagar", "T. Nagar", "Adyar", "Velachery", "Guindy",
            "Tambaram", "Srivilliputhur Bypass", "Madurai Periyar", "Rajapalayam Road", "Sivakasi Junction"
    );

    public static final int REPEAT_N = 3;
    public static final int WINDOW = 30;
    public static final double HOTSPOT_FACTOR = 1.25;

    public static final Map<String, int[]> SCEN = Map.of(
            "Additional monitoring", new int[]{7, 14},
            "Signage and road markings", new int[]{5, 10},
            "Focused enforcement drive", new int[]{10, 18}
    );

    // In-memory active session tokens: token -> SessionUser
    public static final Map<String, SessionUser> SESS = new ConcurrentHashMap<>();

    public static class SessionUser {
        public final int id;
        public final String name;
        public final String role;
        public SessionUser(int id, String name, String role) {
            this.id = id;
            this.name = name;
            this.role = role;
        }
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================
    private static final DateTimeFormatter NOW_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public static String now() {
        return LocalDateTime.now().format(NOW_FMT);
    }

    public static Connection getDb() throws SQLException {
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException ignored) {}
        return DriverManager.getConnection(DB_URL);
    }

    // PBKDF2-HMAC-SHA256 matching Python hashlib.pbkdf2_hmac("sha256", p, salt, 100000)
    public static String hpw(String password, String salt) {
        try {
            if (salt == null) {
                byte[] saltBytes = new byte[8];
                new SecureRandom().nextBytes(saltBytes);
                StringBuilder sb = new StringBuilder();
                for (byte b : saltBytes) sb.append(String.format("%02x", b));
                salt = sb.toString();
            }
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt.getBytes(StandardCharsets.UTF_8), 100000, 256);
            SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            byte[] hash = skf.generateSecret(spec).getEncoded();
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return salt + "$" + hex.toString();
        } catch (Exception e) {
            throw new RuntimeException("Error computing password hash", e);
        }
    }

    public static boolean chk(String password, String hash) {
        if (hash == null || !hash.contains("$")) return false;
        String salt = hash.split("\\$")[0];
        return hpw(password, salt).equals(hash);
    }

    public static String level(int score) {
        if (score <= 30) return "Low";
        if (score <= 60) return "Medium";
        if (score <= 80) return "High";
        return "Critical";
    }

    public static String period(int hour) {
        if (hour >= 5 && hour < 12) return "Morning";
        if (hour >= 12 && hour < 17) return "Afternoon";
        if (hour >= 17 && hour < 21) return "Evening";
        return "Night";
    }

    // =========================================================================
    // RISK ENGINE & ALERTING
    // =========================================================================
    public static class ViolationEntity {
        public int violationId;
        public int driverId;
        public int vehicleId;
        public String violationType;
        public String location;
        public String violationDate;
        public String violationTime;
        public String severity;
        public int fineAmount;
        public String paymentStatus;
        public String evidenceRef;
        public String vehicleNumber;
    }

    public static class PatternItem {
        public String kind;
        public String text;
        public PatternItem(String kind, String text) {
            this.kind = kind;
            this.text = text;
        }
    }

    public static class RiskResult {
        public int score;
        public String level;
        public Map<String, Integer> factors = new LinkedHashMap<>();
        public List<PatternItem> patterns = new ArrayList<>();
        public List<Integer> periods = new ArrayList<>();
        public String trend;
        public int total;
    }

    public static RiskResult calculateRisk(List<ViolationEntity> vs) {
        LocalDate today = LocalDate.now();
        int n = vs.size();

        // 4 consecutive 30-day windows:
        // periods[0]: 90-120d, periods[1]: 60-90d, periods[2]: 30-60d, periods[3]: 0-30d
        int[] per = new int[4];
        for (ViolationEntity v : vs) {
            try {
                LocalDate vDate = LocalDate.parse(v.violationDate);
                long age = ChronoUnit.DAYS.between(vDate, today);
                if (age >= 0 && age < 30) per[3]++;
                else if (age >= 30 && age < 60) per[2]++;
                else if (age >= 60 && age < 90) per[1]++;
                else if (age >= 90 && age < 120) per[0]++;
            } catch (Exception ignored) {}
        }

        RiskResult res = new RiskResult();
        for (int p : per) res.periods.add(p);
        res.total = n;

        if (n == 0) {
            res.score = 0;
            res.level = "Low";
            res.factors.put("frequency", 0);
            res.factors.put("recent", 0);
            res.factors.put("repeat", 0);
            res.factors.put("severity", 0);
            res.trend = "No records";
            return res;
        }

        // Count occurrences per type
        Map<String, Long> typeCounts = vs.stream()
                .collect(Collectors.groupingBy(v -> v.violationType, Collectors.counting()));

        // Frequency factor: 180-day window
        long in180 = vs.stream().filter(v -> {
            try {
                return ChronoUnit.DAYS.between(LocalDate.parse(v.violationDate), today) <= 180;
            } catch (Exception e) { return false; }
        }).count();
        int fFrequency = (int) Math.round(Math.min(100.0, in180 * 12.5));

        // Recent factor: last 30-day window (per[3])
        int fRecent = (int) Math.round(Math.min(100.0, per[3] * 34.0));

        // Repeat factor
        int fRepeat = (int) Math.round(((double) (n - typeCounts.size()) / n) * 100.0);

        // Severity factor
        double sevSum = 0;
        for (ViolationEntity v : vs) {
            sevSum += SEV.getOrDefault(v.severity, 25);
        }
        int fSeverity = (int) Math.round(sevSum / n);

        res.factors.put("frequency", fFrequency);
        res.factors.put("recent", fRecent);
        res.factors.put("repeat", fRepeat);
        res.factors.put("severity", fSeverity);

        res.score = (int) Math.round(0.30 * fFrequency + 0.25 * fRecent + 0.25 * fRepeat + 0.20 * fSeverity);
        res.level = level(res.score);

        // Pattern detection: 3+ of same violation within 30 days
        for (String ty : typeCounts.keySet()) {
            List<LocalDate> dates = vs.stream()
                    .filter(v -> ty.equals(v.violationType))
                    .map(v -> LocalDate.parse(v.violationDate))
                    .sorted()
                    .collect(Collectors.toList());

            for (int i = 0; i <= dates.size() - REPEAT_N; i++) {
                if (ChronoUnit.DAYS.between(dates.get(i), dates.get(i + REPEAT_N - 1)) <= WINDOW) {
                    res.patterns.add(new PatternItem("repeat", "Repeated " + ty + ": " + REPEAT_N + "+ within " + WINDOW + " days"));
                    break;
                }
            }
        }

        // Rising activity pattern
        if (per[3] >= 2 && per[3] > per[2]) {
            res.patterns.add(new PatternItem("increase", "Recent activity increasing: " + per[3] + " in the last 30 days vs " + per[2] + " before"));
        }

        // Trend
        if (per[3] < per[2]) res.trend = "Improving";
        else if (per[3] > per[2]) res.trend = "Worsening";
        else res.trend = "Stable";

        return res;
    }

    public static class RefreshAlertResult {
        public RiskResult risk;
        public int newAlerts;
    }

    // =========================================================================
    // SMART ALERT PRIORITIZATION (Heap / PriorityQueue / Comparator)
    //
    // Every alert is scored 0-100 and pushed onto a max-heap; polling the heap
    // returns the most important alert first:
    //
    //   priority = 50% severity weight + 30% driver risk score + 20% urgency
    //
    // An OPEN alert grows more urgent the longer it stays unanswered; a
    // REVIEWED alert fades quickly.
    // =========================================================================

    public static class AlertItem {
        public int alertId;
        public Integer driverId;
        public String driverName;
        public String alertType;
        public String message;
        public String severity;
        public String status;
        public String createdAt;
        public int priority;
        public String priorityLabel;
        public int riskScore;
        public int urgency;
    }

    /** 0-100 urgency of an alert from its age and workflow status. */
    public static int urgencyScore(String createdAt, boolean open) {
        try {
            LocalDateTime created = LocalDateTime.parse(createdAt, NOW_FMT);
            long daysOpen = Math.max(0, ChronoUnit.DAYS.between(created, LocalDateTime.now()));
            return open
                    ? (int) Math.min(100, 40 + daysOpen * 8)
                    : (int) Math.min(100, 15 + daysOpen * 3);
        } catch (Exception e) {
            return open ? 40 : 15;
        }
    }

    /** Weighted 0-100 priority: severity 50%, driver risk 30%, urgency 20%. */
    public static int alertPriority(String severity, int riskScore, int urgency) {
        int sevW = ALERT_SEV.getOrDefault(severity == null ? "" : severity, 25);
        int risk = Math.max(0, Math.min(100, riskScore));
        int urg = Math.max(0, Math.min(100, urgency));
        return (int) Math.round(0.50 * sevW + 0.30 * risk + 0.20 * urg);
    }

    public static String priorityLabel(int priority) {
        if (priority >= 81) return "Critical";
        if (priority >= 61) return "High";
        if (priority >= 41) return "Medium";
        if (priority >= 21) return "Low";
        return "Info";
    }

    public static RefreshAlertResult refreshAlerts(Connection c, int driverId) throws SQLException {
        List<ViolationEntity> vs = getViolationsForDriver(c, driverId);
        RiskResult r = calculateRisk(vs);
        int newCount = 0;

        List<String[]> candidates = new ArrayList<>();
        for (PatternItem p : r.patterns) {
            String type = "repeat".equals(p.kind) ? "Repeated Violation" : "Frequency Increase";
            candidates.add(new String[]{type, p.text, "Medium"});
        }

        if (r.score >= 61) {
            String sev = r.score <= 80 ? "High" : "Critical";
            candidates.add(new String[]{
                    "High Risk Review",
                    "Risk score " + r.score + "/100 (" + r.level + ") with " + r.total + " violations in the available records",
                    sev
            });
        }

        if ("Improving".equals(r.trend) && r.total >= 3) {
            candidates.add(new String[]{
                    "Improvement Trend",
                    "Recorded violations fell from " + r.periods.get(2) + " to " + r.periods.get(3) + " in the latest 30 days",
                    "Info"
            });
        }

        for (String[] cand : candidates) {
            String typ = cand[0];
            String msg = cand[1];
            String sev = cand[2];

            try (PreparedStatement check = c.prepareStatement(
                    "select 1 from alerts where driver_id=? and alert_type=? and status='Open'")) {
                check.setInt(1, driverId);
                check.setString(2, typ);
                ResultSet rs = check.executeQuery();
                if (!rs.next()) {
                    try (PreparedStatement ins = c.prepareStatement(
                            "insert into alerts(driver_id,alert_type,message,severity,created_at,status) values(?,?,?,?,?,'Open')")) {
                        ins.setInt(1, driverId);
                        ins.setString(2, typ);
                        ins.setString(3, msg);
                        ins.setString(4, sev);
                        ins.setString(5, now());
                        ins.executeUpdate();
                        newCount++;
                    }
                }
            }
        }

        RefreshAlertResult result = new RefreshAlertResult();
        result.risk = r;
        result.newAlerts = newCount;
        return result;
    }

    private static List<ViolationEntity> getViolationsForDriver(Connection c, int driverId) throws SQLException {
        List<ViolationEntity> list = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement("select * from violations where driver_id=?")) {
            ps.setInt(1, driverId);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                ViolationEntity v = new ViolationEntity();
                v.violationId = rs.getInt("violation_id");
                v.driverId = rs.getInt("driver_id");
                v.vehicleId = rs.getInt("vehicle_id");
                v.violationType = rs.getString("violation_type");
                v.location = rs.getString("location");
                v.violationDate = rs.getString("violation_date");
                v.violationTime = rs.getString("violation_time");
                v.severity = rs.getString("severity");
                v.fineAmount = rs.getInt("fine_amount");
                v.paymentStatus = rs.getString("payment_status");
                v.evidenceRef = rs.getString("evidence_reference");
                list.add(v);
            }
        }
        return list;
    }

    // =========================================================================
    // DATABASE INITIALIZATION & SEEDER
    // =========================================================================
    public static void seed() {
        try (Connection c = getDb(); Statement stmt = c.createStatement()) {
            stmt.executeUpdate("create table if not exists users(id integer primary key,name text,username text unique,password_hash text,role text,created_at text);");
            stmt.executeUpdate("create table if not exists drivers(driver_id integer primary key,name text,license_number text unique,phone text,address text,created_at text);");
            stmt.executeUpdate("create table if not exists vehicles(vehicle_id integer primary key,vehicle_number text unique,vehicle_type text,model text,driver_id integer,registration_status text,created_at text);");
            stmt.executeUpdate("create table if not exists violations(violation_id integer primary key,driver_id integer,vehicle_id integer,officer_id integer,violation_type text,location text,violation_date text,violation_time text,severity text,fine_amount integer,payment_status text,evidence_reference text,created_at text);");
            stmt.executeUpdate("create table if not exists alerts(alert_id integer primary key,driver_id integer,alert_type text,message text,severity text,created_at text,status text);");

            ResultSet rs = stmt.executeQuery("select count(*) from users");
            if (rs.next() && rs.getInt(1) > 0) {
                return; // already seeded
            }

            System.out.println("Seeding demo database with synthetic traffic records...");

            // Seed Users
            try (PreparedStatement ps = c.prepareStatement("insert into users(name,username,password_hash,role,created_at) values(?,?,?,?,?)")) {
                ps.setString(1, "Admin Office");
                ps.setString(2, "admin");
                ps.setString(3, hpw("admin123", null));
                ps.setString(4, "Administrator");
                ps.setString(5, now());
                ps.executeUpdate();

                ps.setString(1, "Officer Kavya");
                ps.setString(2, "officer");
                ps.setString(3, hpw("officer123", null));
                ps.setString(4, "Traffic Officer");
                ps.setString(5, now());
                ps.executeUpdate();
            }

            Random R = new Random(7);
            String[] first = "Arun Bala Chitra Deepa Elango Farook Gowri Hari Indu Jothi Karthik Lakshmi Madhan Nithya Om Priya Ravi Selvi Tamil Uma Vijay Yamini".split(" ");
            String[] last = "Kumar Raj Devi Pandian Nair Iyer Murugan Sekar Rao Babu Selvam Krishnan".split(" ");
            String[][] vt = new String[][]{
                    {"Motorcycle", "Splendor"}, {"Motorcycle", "Pulsar"},
                    {"Car", "Swift"}, {"Car", "i20"},
                    {"Scooter", "Activa"}, {"Truck", "Tata 407"}
            };

            // Seed 150 Drivers & Vehicles
            try (PreparedStatement psDriver = c.prepareStatement("insert into drivers values(?,?,?,?,?,?)");
                 PreparedStatement psVeh = c.prepareStatement("insert into vehicles values(?,?,?,?,?,?,?)")) {
                for (int i = 1; i <= 150; i++) {
                    String name = first[R.nextInt(first.length)] + " " + last[R.nextInt(last.length)];
                    String lic = "TN" + (R.nextInt(90) + 10) + (2010 + i % 14) + (R.nextInt(900000) + 100000);
                    String phone = "9" + (R.nextInt(900000000) + 100000000);
                    String addr = (R.nextInt(99) + 1) + ", " + LOCS.get(R.nextInt(LOCS.size()));
                    psDriver.setInt(1, i);
                    psDriver.setString(2, name);
                    psDriver.setString(3, lic);
                    psDriver.setString(4, phone);
                    psDriver.setString(5, addr);
                    psDriver.setString(6, now());
                    psDriver.executeUpdate();

                    String[] pair = vt[R.nextInt(vt.length)];
                    char c1 = "ABCDEFGH".charAt(R.nextInt(8));
                    char c2 = "KLMNPQ".charAt(R.nextInt(6));
                    String vnum = "TN " + (R.nextInt(90) + 10) + " " + c1 + c2 + " " + (R.nextInt(9000) + 1000);
                    psVeh.setInt(1, i);
                    psVeh.setString(2, vnum);
                    psVeh.setString(3, pair[0]);
                    psVeh.setString(4, pair[1]);
                    psVeh.setInt(5, i);
                    psVeh.setString(6, "Active");
                    psVeh.setString(7, now());
                    psVeh.executeUpdate();
                }
            }

            // Seed Violations
            List<String> tw = new ArrayList<>(TYPES.keySet());
            LocalDate today = LocalDate.now();
            int vid = 0;
            int[] hoursPool = new int[]{8, 9, 9, 10, 13, 15, 17, 18, 18, 19, 19, 20, 22};
            String[] statuses = new String[]{"Paid", "Paid", "Pending"};

            try (PreparedStatement psViol = c.prepareStatement("insert into violations values(?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
                for (int d = 1; d <= 150; d++) {
                    double k = R.nextDouble();
                    int n = k < 0.55 ? R.nextInt(4) : (k < 0.90 ? (R.nextInt(5) + 3) : (R.nextInt(7) + 8));
                    String fav = tw.get(R.nextInt(tw.size()));

                    for (int j = 0; j < n; j++) {
                        String ty;
                        if ((n > 7 && R.nextDouble() < 0.6) || R.nextDouble() < 0.3) {
                            ty = fav;
                        } else {
                            ty = tw.get(R.nextInt(tw.size()));
                        }

                        // Triangular days distribution
                        double mode = n > 7 ? 8.0 : 90.0;
                        int days = (int) Math.round(triangularRandom(R, 1, 240, mode));

                        int h = R.nextDouble() < 0.8 ? hoursPool[R.nextInt(hoursPool.length)] : R.nextInt(24);
                        int m = R.nextInt(60);
                        String timeStr = String.format("%02d:%02d", h, m);
                        String dateStr = today.minusDays(days).toString();

                        ViolationRule rule = TYPES.get(ty);
                        vid++;

                        psViol.setInt(1, vid);
                        psViol.setInt(2, d);
                        psViol.setInt(3, d);
                        psViol.setInt(4, R.nextInt(2) + 1);
                        psViol.setString(5, ty);
                        psViol.setString(6, LOCS.get(R.nextInt(LOCS.size())));
                        psViol.setString(7, dateStr);
                        psViol.setString(8, timeStr);
                        psViol.setString(9, rule.severity);
                        psViol.setInt(10, rule.fine);
                        psViol.setString(11, statuses[R.nextInt(statuses.length)]);
                        psViol.setString(12, String.format("EV-%05d", vid));
                        psViol.setString(13, now());
                        psViol.executeUpdate();
                    }
                }
            }

            // Refresh initial alerts
            for (int d = 1; d <= 150; d++) {
                refreshAlerts(c, d);
            }

            System.out.println("Seeding completed: " + vid + " violations generated.");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static double triangularRandom(Random r, double low, double high, double mode) {
        double u = r.nextDouble();
        double c = (mode - low) / (high - low);
        if (u <= c) {
            return low + Math.sqrt(u * (high - low) * (mode - low));
        } else {
            return high - Math.sqrt((1 - u) * (high - low) * (high - mode));
        }
    }

    // =========================================================================
    // ANALYTICS & REPORTING
    // =========================================================================
    public static Map<String, Object> getAnalytics(Connection c) throws SQLException {
        List<ViolationEntity> vs = new ArrayList<>();
        try (Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("select * from violations")) {
            while (rs.next()) {
                ViolationEntity v = new ViolationEntity();
                v.violationId = rs.getInt("violation_id");
                v.driverId = rs.getInt("driver_id");
                v.vehicleId = rs.getInt("vehicle_id");
                v.violationType = rs.getString("violation_type");
                v.location = rs.getString("location");
                v.violationDate = rs.getString("violation_date");
                v.violationTime = rs.getString("violation_time");
                v.severity = rs.getString("severity");
                v.fineAmount = rs.getInt("fine_amount");
                v.paymentStatus = rs.getString("payment_status");
                vs.add(v);
            }
        }

        // Violations by type
        Map<String, Long> typeCounts = vs.stream()
                .collect(Collectors.groupingBy(v -> v.violationType, Collectors.counting()));
        List<List<Object>> byType = typeCounts.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .map(e -> List.<Object>of(e.getKey(), e.getValue()))
                .collect(Collectors.toList());

        // Violations by location
        Map<String, Long> locCounts = vs.stream()
                .collect(Collectors.groupingBy(v -> v.location, Collectors.counting()));
        double avgLoc = locCounts.values().stream().mapToLong(Long::longValue).average().orElse(1.0);
        double thr = avgLoc * HOTSPOT_FACTOR;

        LocalDate today = LocalDate.now();
        List<Map<String, Object>> byLocation = new ArrayList<>();
        List<Map.Entry<String, Long>> sortedLocs = locCounts.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .collect(Collectors.toList());

        for (Map.Entry<String, Long> entry : sortedLocs) {
            String locName = entry.getKey();
            long count = entry.getValue();
            List<ViolationEntity> lv = vs.stream().filter(v -> locName.equals(v.location)).collect(Collectors.toList());
            long rec = lv.stream().filter(v -> {
                try {
                    return ChronoUnit.DAYS.between(LocalDate.parse(v.violationDate), today) <= 30;
                } catch (Exception e) { return false; }
            }).count();

            String topType = lv.stream()
                    .collect(Collectors.groupingBy(v -> v.violationType, Collectors.counting()))
                    .entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse("-");

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("location", locName);
            item.put("count", count);
            item.put("hotspot", count > thr);
            item.put("recent30", rec);
            item.put("top_type", topType);
            byLocation.add(item);
        }

        // By hour
        int[] hoursArr = new int[24];
        for (ViolationEntity v : vs) {
            try {
                int hr = Integer.parseInt(v.violationTime.substring(0, 2));
                if (hr >= 0 && hr < 24) hoursArr[hr]++;
            } catch (Exception ignored) {}
        }
        List<List<Object>> byHour = new ArrayList<>();
        for (int h = 0; h < 24; h++) {
            byHour.add(List.of(String.format("%02d:00", h), hoursArr[h]));
        }

        // By period
        Map<String, Integer> perCounts = new LinkedHashMap<>();
        perCounts.put("Morning", 0);
        perCounts.put("Afternoon", 0);
        perCounts.put("Evening", 0);
        perCounts.put("Night", 0);
        for (int h = 0; h < 24; h++) {
            String pName = period(h);
            perCounts.put(pName, perCounts.get(pName) + hoursArr[h]);
        }
        List<List<Object>> byPeriod = perCounts.entrySet().stream()
                .map(e -> List.<Object>of(e.getKey(), e.getValue()))
                .collect(Collectors.toList());

        // By Day of Week (Mon - Sun)
        Map<String, Integer> dowCounts = new LinkedHashMap<>();
        for (String day : new String[]{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}) {
            dowCounts.put(day, 0);
        }
        DateTimeFormatter dowFmt = DateTimeFormatter.ofPattern("EEE", Locale.ENGLISH);
        for (ViolationEntity v : vs) {
            try {
                String d = LocalDate.parse(v.violationDate).format(dowFmt);
                if (dowCounts.containsKey(d)) {
                    dowCounts.put(d, dowCounts.get(d) + 1);
                }
            } catch (Exception ignored) {}
        }
        List<List<Object>> byDow = dowCounts.entrySet().stream()
                .map(e -> List.<Object>of(e.getKey(), e.getValue()))
                .collect(Collectors.toList());

        // By Month (last 8 months)
        List<String> monthKeys = new ArrayList<>();
        LocalDate cur = today.withDayOfMonth(1);
        for (int m = 0; m < 8; m++) {
            monthKeys.add(0, cur.format(DateTimeFormatter.ofPattern("yyyy-MM")));
            cur = cur.minusMonths(1);
        }
        Map<String, Integer> monthCounts = new LinkedHashMap<>();
        for (String mk : monthKeys) monthCounts.put(mk, 0);
        for (ViolationEntity v : vs) {
            if (v.violationDate.length() >= 7) {
                String mKey = v.violationDate.substring(0, 7);
                if (monthCounts.containsKey(mKey)) {
                    monthCounts.put(mKey, monthCounts.get(mKey) + 1);
                }
            }
        }
        List<List<Object>> byMonth = monthCounts.entrySet().stream()
                .map(e -> List.<Object>of(e.getKey(), e.getValue()))
                .collect(Collectors.toList());

        // All risks & distribution
        Map<Integer, List<ViolationEntity>> grouped = vs.stream()
                .collect(Collectors.groupingBy(v -> v.driverId));

        int driverCount = 0;
        int highRiskCount = 0;
        Map<String, Integer> dist = new LinkedHashMap<>();
        dist.put("Low", 0);
        dist.put("Medium", 0);
        dist.put("High", 0);
        dist.put("Critical", 0);

        try (Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("select driver_id from drivers")) {
            while (rs.next()) {
                driverCount++;
                int did = rs.getInt("driver_id");
                RiskResult rk = calculateRisk(grouped.getOrDefault(did, Collections.emptyList()));
                dist.put(rk.level, dist.getOrDefault(rk.level, 0) + 1);
                if (rk.score >= 61) highRiskCount++;
            }
        }

        List<List<Object>> riskDist = dist.entrySet().stream()
                .map(e -> List.<Object>of(e.getKey(), e.getValue()))
                .collect(Collectors.toList());

        int vehCount = 0;
        try (Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("select count(*) from vehicles")) {
            if (rs.next()) vehCount = rs.getInt(1);
        }

        long pendingCount = vs.stream().filter(v -> "Pending".equals(v.paymentStatus)).count();
        long pendingAmount = vs.stream().filter(v -> "Pending".equals(v.paymentStatus)).mapToLong(v -> v.fineAmount).sum();
        String topViol = byType.isEmpty() ? "-" : (String) byType.get(0).get(0);
        String topHotspot = byLocation.isEmpty() ? "-" : (String) byLocation.get(0).get("location");
        String peakPer = perCounts.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("-");
        long hotspotsTotal = byLocation.stream().filter(l -> Boolean.TRUE.equals(l.get("hotspot"))).count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("drivers", driverCount);
        stats.put("vehicles", vehCount);
        stats.put("violations", vs.size());
        stats.put("pending_count", pendingCount);
        stats.put("pending_amount", pendingAmount);
        stats.put("high_risk", highRiskCount);
        stats.put("top_violation", topViol);
        stats.put("top_hotspot", topHotspot);
        stats.put("peak_period", peakPer);
        stats.put("hotspots", hotspotsTotal);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stats", stats);
        result.put("by_type", byType);
        result.put("by_location", byLocation);
        result.put("by_period", byPeriod);
        result.put("by_hour", byHour);
        result.put("by_dow", byDow);
        result.put("by_month", byMonth);
        result.put("risk_dist", riskDist);
        return result;
    }

    public static Map<String, Object> getDriverDetail(Connection c, int did) throws SQLException {
        Map<String, Object> driverMap = null;
        try (PreparedStatement ps = c.prepareStatement("select * from drivers where driver_id=?")) {
            ps.setInt(1, did);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                driverMap = new LinkedHashMap<>();
                driverMap.put("driver_id", rs.getInt("driver_id"));
                driverMap.put("name", rs.getString("name"));
                driverMap.put("license_number", rs.getString("license_number"));
                driverMap.put("phone", rs.getString("phone"));
                driverMap.put("address", rs.getString("address"));
            }
        }
        if (driverMap == null) return null;

        List<Map<String, Object>> vehicles = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement("select * from vehicles where driver_id=?")) {
            ps.setInt(1, did);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> v = new LinkedHashMap<>();
                v.put("vehicle_id", rs.getInt("vehicle_id"));
                v.put("vehicle_number", rs.getString("vehicle_number"));
                v.put("vehicle_type", rs.getString("vehicle_type"));
                v.put("model", rs.getString("model"));
                vehicles.add(v);
            }
        }

        List<ViolationEntity> vsEntities = new ArrayList<>();
        List<Map<String, Object>> violations = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(
                "select v.*, ve.vehicle_number from violations v join vehicles ve on ve.vehicle_id=v.vehicle_id where v.driver_id=? order by v.violation_date desc, v.violation_time desc")) {
            ps.setInt(1, did);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                ViolationEntity ve = new ViolationEntity();
                ve.violationId = rs.getInt("violation_id");
                ve.violationDate = rs.getString("violation_date");
                ve.violationTime = rs.getString("violation_time");
                ve.violationType = rs.getString("violation_type");
                ve.location = rs.getString("location");
                ve.fineAmount = rs.getInt("fine_amount");
                ve.paymentStatus = rs.getString("payment_status");
                ve.severity = rs.getString("severity");
                ve.vehicleNumber = rs.getString("vehicle_number");
                vsEntities.add(ve);

                Map<String, Object> vm = new LinkedHashMap<>();
                vm.put("violation_id", ve.violationId);
                vm.put("violation_date", ve.violationDate);
                vm.put("violation_time", ve.violationTime);
                vm.put("violation_type", ve.violationType);
                vm.put("location", ve.location);
                vm.put("fine_amount", ve.fineAmount);
                vm.put("payment_status", ve.paymentStatus);
                vm.put("vehicle_number", ve.vehicleNumber);
                violations.add(vm);
            }
        }

        List<Map<String, Object>> alerts = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement("select * from alerts where driver_id=? order by alert_id desc")) {
            ps.setInt(1, did);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> a = new LinkedHashMap<>();
                a.put("alert_id", rs.getInt("alert_id"));
                a.put("alert_type", rs.getString("alert_type"));
                a.put("message", rs.getString("message"));
                a.put("severity", rs.getString("severity"));
                a.put("created_at", rs.getString("created_at"));
                a.put("status", rs.getString("status"));
                alerts.add(a);
            }
        }

        RiskResult risk = calculateRisk(vsEntities);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("driver", driverMap);
        result.put("vehicles", vehicles);
        result.put("violations", violations);
        result.put("risk", risk);
        result.put("alerts", alerts);
        return result;
    }

    public static String generateReport(Connection c, String kind, String arg) throws SQLException {
        Map<String, Object> a = getAnalytics(c);
        @SuppressWarnings("unchecked")
        Map<String, Object> s = (Map<String, Object>) a.get("stats");

        StringBuilder sb = new StringBuilder();
        sb.append("ROADWISE - ").append(kind.toUpperCase()).append(" REPORT\n");
        sb.append("Generated: ").append(now()).append("\n");
        sb.append("Prototype rules, synthetic data. Decision support only - not an official score or legal decision.\n\n");

        if ("summary".equals(kind)) {
            for (Map.Entry<String, Object> e : s.entrySet()) {
                String title = e.getKey().replace('_', ' ');
                title = Character.toUpperCase(title.charAt(0)) + title.substring(1);
                sb.append(title).append(": ").append(e.getValue()).append("\n");
            }
            sb.append("\nViolations by type:\n");
            @SuppressWarnings("unchecked")
            List<List<Object>> byType = (List<List<Object>>) a.get("by_type");
            for (List<Object> item : byType) {
                sb.append("  ").append(item.get(0)).append(": ").append(item.get(1)).append("\n");
            }
        } else if ("hotspot".equals(kind)) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> byLoc = (List<Map<String, Object>>) a.get("by_location");
            for (Map<String, Object> l : byLoc) {
                sb.append(l.get("location")).append(": ")
                        .append(l.get("count")).append(" total, ")
                        .append(l.get("recent30")).append(" in last 30 days, top type ")
                        .append(l.get("top_type"))
                        .append(Boolean.TRUE.equals(l.get("hotspot")) ? "  [HOTSPOT]" : "")
                        .append("\n");
            }
        } else if ("time".equals(kind)) {
            sb.append("By period:\n");
            @SuppressWarnings("unchecked")
            List<List<Object>> byPeriod = (List<List<Object>>) a.get("by_period");
            for (List<Object> item : byPeriod) {
                sb.append("  ").append(item.get(0)).append(": ").append(item.get(1)).append("\n");
            }
            sb.append("By day:\n");
            @SuppressWarnings("unchecked")
            List<List<Object>> byDow = (List<List<Object>>) a.get("by_dow");
            for (List<Object> item : byDow) {
                sb.append("  ").append(item.get(0)).append(": ").append(item.get(1)).append("\n");
            }
            sb.append("By hour:\n");
            @SuppressWarnings("unchecked")
            List<List<Object>> byHour = (List<List<Object>>) a.get("by_hour");
            for (List<Object> item : byHour) {
                sb.append("  ").append(item.get(0)).append("  ").append(item.get(1)).append("\n");
            }
        } else if ("risk".equals(kind)) {
            @SuppressWarnings("unchecked")
            List<List<Object>> riskDist = (List<List<Object>>) a.get("risk_dist");
            for (List<Object> item : riskDist) {
                sb.append(item.get(0)).append(": ").append(item.get(1)).append(" drivers\n");
            }
        } else if ("improvement".equals(kind)) {
            @SuppressWarnings("unchecked")
            List<List<Object>> byMonth = (List<List<Object>>) a.get("by_month");
            for (List<Object> item : byMonth) {
                sb.append(item.get(0)).append(": ").append(item.get(1)).append(" violations\n");
            }
            sb.append("\nNote: reflects recorded violations only, not proof of changed behaviour.\n");
        } else if ("driver".equals(kind)) {
            int did = 0;
            try { did = Integer.parseInt(arg); } catch (Exception ignored) {}
            Map<String, Object> d = getDriverDetail(c, did);
            if (d == null) return "Driver not found";
            @SuppressWarnings("unchecked")
            Map<String, Object> dr = (Map<String, Object>) d.get("driver");
            RiskResult rk = (RiskResult) d.get("risk");

            sb.append("Driver: ").append(dr.get("name")).append(" (").append(dr.get("license_number")).append(")\n");
            sb.append("Risk: ").append(rk.score).append("/100 ").append(rk.level).append("\n");
            sb.append("Factors: ").append(rk.factors).append("\n");
            sb.append("Trend (recorded): ").append(rk.trend)
                    .append("  periods(30d, oldest->latest): ").append(rk.periods).append("\n");

            String patStr = rk.patterns.stream().map(p -> p.text).collect(Collectors.joining("; "));
            sb.append("Patterns: ").append(patStr.isEmpty() ? "none" : patStr).append("\n\nHistory:\n");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> vList = (List<Map<String, Object>>) d.get("violations");
            for (Map<String, Object> v : vList) {
                sb.append("  ").append(v.get("violation_date")).append(" ")
                        .append(v.get("violation_time")).append(" ")
                        .append(v.get("violation_type")).append(" @ ")
                        .append(v.get("location")).append(" Rs.")
                        .append(v.get("fine_amount")).append(" ")
                        .append(v.get("payment_status")).append("\n");
            }
        } else if ("csv".equals(kind)) {
            sb.setLength(0); // clear header for CSV
            sb.append("violation_id,driver_id,vehicle_id,type,location,date,time,severity,fine,status\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("select * from violations order by violation_date desc")) {
                while (rs.next()) {
                    sb.append(rs.getInt(1)).append(",")
                            .append(rs.getInt(2)).append(",")
                            .append(rs.getInt(3)).append(",")
                            .append(rs.getString(5)).append(",")
                            .append(rs.getString(6)).append(",")
                            .append(rs.getString(7)).append(",")
                            .append(rs.getString(8)).append(",")
                            .append(rs.getString(9)).append(",")
                            .append(rs.getInt(10)).append(",")
                            .append(rs.getString(11)).append("\n");
                }
            }
        }

        return sb.toString();
    }

    // =========================================================================
    // LIGHTWEIGHT JSON SERIALIZER & PARSER (Zero Dependency)
    // =========================================================================
    public static class Json {
        public static String stringify(Object obj) {
            if (obj == null) return "null";
            if (obj instanceof String) return "\"" + escape((String) obj) + "\"";
            if (obj instanceof Number || obj instanceof Boolean) return obj.toString();
            if (obj instanceof PatternItem) {
                PatternItem p = (PatternItem) obj;
                return "{\"kind\":\"" + escape(p.kind) + "\",\"text\":\"" + escape(p.text) + "\"}";
            }
            if (obj instanceof RiskResult) {
                RiskResult r = (RiskResult) obj;
                StringBuilder sb = new StringBuilder("{");
                sb.append("\"score\":").append(r.score).append(",");
                sb.append("\"level\":\"").append(r.level).append("\",");
                sb.append("\"factors\":").append(stringify(r.factors)).append(",");
                sb.append("\"patterns\":").append(stringify(r.patterns)).append(",");
                sb.append("\"periods\":").append(stringify(r.periods)).append(",");
                sb.append("\"trend\":\"").append(r.trend).append("\",");
                sb.append("\"total\":").append(r.total).append("}");
                return sb.toString();
            }
            if (obj instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = (Map<String, Object>) obj;
                StringBuilder sb = new StringBuilder("{");
                boolean first = true;
                for (Map.Entry<String, Object> entry : map.entrySet()) {
                    if (!first) sb.append(",");
                    first = false;
                    sb.append("\"").append(escape(entry.getKey())).append("\":").append(stringify(entry.getValue()));
                }
                sb.append("}");
                return sb.toString();
            }
            if (obj instanceof Collection) {
                Collection<?> col = (Collection<?>) obj;
                StringBuilder sb = new StringBuilder("[");
                boolean first = true;
                for (Object item : col) {
                    if (!first) sb.append(",");
                    first = false;
                    sb.append(stringify(item));
                }
                sb.append("]");
                return sb.toString();
            }
            return "\"" + escape(obj.toString()) + "\"";
        }

        private static String escape(String s) {
            if (s == null) return "";
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < s.length(); i++) {
                char ch = s.charAt(i);
                switch (ch) {
                    case '"': sb.append("\\\""); break;
                    case '\\': sb.append("\\\\"); break;
                    case '\b': sb.append("\\b"); break;
                    case '\f': sb.append("\\f"); break;
                    case '\n': sb.append("\\n"); break;
                    case '\r': sb.append("\\r"); break;
                    case '\t': sb.append("\\t"); break;
                    default:
                        if (ch <= '\u001F') {
                            sb.append(String.format("\\u%04x", (int) ch));
                        } else {
                            sb.append(ch);
                        }
                }
            }
            return sb.toString();
        }

        // Basic map parser for payload keys
        public static Map<String, Object> parseMap(String json) {
            Map<String, Object> map = new LinkedHashMap<>();
            if (json == null) return map;
            json = json.trim();
            if (!json.startsWith("{") || !json.endsWith("}")) return map;
            json = json.substring(1, json.length() - 1).trim();
            if (json.isEmpty()) return map;

            List<String> tokens = splitTopLevel(json);
            for (String tok : tokens) {
                int colon = tok.indexOf(':');
                if (colon == -1) continue;
                String k = tok.substring(0, colon).trim();
                String v = tok.substring(colon + 1).trim();
                if (k.startsWith("\"") && k.endsWith("\"")) k = k.substring(1, k.length() - 1);
                if (v.startsWith("\"") && v.endsWith("\"")) {
                    map.put(k, unescape(v.substring(1, v.length() - 1)));
                } else if ("true".equalsIgnoreCase(v)) {
                    map.put(k, true);
                } else if ("false".equalsIgnoreCase(v)) {
                    map.put(k, false);
                } else if ("null".equalsIgnoreCase(v)) {
                    map.put(k, null);
                } else {
                    try {
                        if (v.contains(".")) map.put(k, Double.parseDouble(v));
                        else map.put(k, Long.parseLong(v));
                    } catch (Exception e) {
                        map.put(k, v);
                    }
                }
            }
            return map;
        }

        private static List<String> splitTopLevel(String s) {
            List<String> list = new ArrayList<>();
            int depth = 0;
            boolean inQuote = false;
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                if (c == '"' && (i == 0 || s.charAt(i - 1) != '\\')) {
                    inQuote = !inQuote;
                }
                if (!inQuote) {
                    if (c == '{' || c == '[') depth++;
                    else if (c == '}' || c == ']') depth--;
                    else if (c == ',' && depth == 0) {
                        list.add(sb.toString().trim());
                        sb.setLength(0);
                        continue;
                    }
                }
                sb.append(c);
            }
            if (sb.length() > 0) list.add(sb.toString().trim());
            return list;
        }

        private static String unescape(String s) {
            return s.replace("\\\"", "\"").replace("\\\\", "\\").replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t");
        }
    }

    // =========================================================================
    // HTTP HANDLER & REST API DISPATCHER
    // =========================================================================
    public static class ApiHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod().toUpperCase();
            boolean isPost = "POST".equals(method);

            // Serve landing HTML if not /api
            if (!path.startsWith("/api")) {
                File htmlFile = new File(BASE_DIR, "index.html");
                if (htmlFile.exists()) {
                    byte[] bytes = Files.readAllBytes(htmlFile.toPath());
                    send(exchange, 200, bytes, "text/html");
                } else {
                    send(exchange, 200, "Roadwise Traffic Backend (Java) running.".getBytes(StandardCharsets.UTF_8), "text/plain");
                }
                return;
            }

            try (Connection c = getDb()) {
                Map<String, String> q = parseQuery(exchange.getRequestURI().getQuery());
                Map<String, Object> body = isPost ? Json.parseMap(readBody(exchange)) : Collections.emptyMap();

                // Public Endpoint
                if ("/api/public".equals(path)) {
                    Map<String, Object> a = getAnalytics(c);
                    @SuppressWarnings("unchecked")
                    Map<String, Object> s = (Map<String, Object>) a.get("stats");
                    Map<String, Object> pub = new LinkedHashMap<>();
                    pub.put("violations", s.get("violations"));
                    pub.put("drivers", s.get("drivers"));
                    pub.put("hotspots", s.get("hotspots"));
                    pub.put("high_risk", s.get("high_risk"));
                    sendJson(exchange, 200, pub);
                    return;
                }

                // Login Endpoint
                if ("/api/login".equals(path) && isPost) {
                    String username = String.valueOf(body.getOrDefault("username", ""));
                    String password = String.valueOf(body.getOrDefault("password", ""));

                    try (PreparedStatement ps = c.prepareStatement("select * from users where username=?")) {
                        ps.setString(1, username);
                        ResultSet rs = ps.executeQuery();
                        if (!rs.next() || !chk(password, rs.getString("password_hash"))) {
                            sendJson(exchange, 401, Map.of("error", "Wrong username or password"));
                            return;
                        }

                        byte[] tBytes = new byte[16];
                        new SecureRandom().nextBytes(tBytes);
                        StringBuilder sb = new StringBuilder();
                        for (byte b : tBytes) sb.append(String.format("%02x", b));
                        String token = sb.toString();

                        SessionUser su = new SessionUser(rs.getInt("id"), rs.getString("name"), rs.getString("role"));
                        SESS.put(token, su);

                        Map<String, Object> resp = new LinkedHashMap<>();
                        resp.put("token", token);
                        resp.put("user", Map.of("id", su.id, "name", su.name, "role", su.role));
                        sendJson(exchange, 200, resp);
                        return;
                    }
                }

                // Authentication Check
                SessionUser me = getUser(exchange);
                if (me == null) {
                    sendJson(exchange, 401, Map.of("error", "Please sign in"));
                    return;
                }

                // Authenticated Endpoints
                if ("/api/analytics".equals(path)) {
                    sendJson(exchange, 200, getAnalytics(c));
                    return;
                }

                if ("/api/drivers".equals(path)) {
                    String sParam = "%" + q.getOrDefault("q", "") + "%";
                    List<Map<String, Object>> rows = new ArrayList<>();
                    try (PreparedStatement ps = c.prepareStatement(
                            "select d.driver_id, d.name, d.license_number, ve.vehicle_number " +
                            "from drivers d left join vehicles ve on ve.driver_id=d.driver_id " +
                            "where d.name like ? or d.license_number like ? or ve.vehicle_number like ?")) {
                        ps.setString(1, sParam);
                        ps.setString(2, sParam);
                        ps.setString(3, sParam);
                        ResultSet rs = ps.executeQuery();
                        while (rs.next()) {
                            int did = rs.getInt("driver_id");
                            List<ViolationEntity> vs = getViolationsForDriver(c, did);
                            RiskResult rk = calculateRisk(vs);

                            Map<String, Object> dm = new LinkedHashMap<>();
                            dm.put("driver_id", did);
                            dm.put("name", rs.getString("name"));
                            dm.put("license_number", rs.getString("license_number"));
                            dm.put("vehicle_number", rs.getString("vehicle_number"));
                            dm.put("score", rk.score);
                            dm.put("level", rk.level);
                            dm.put("total", rk.total);
                            rows.add(dm);
                        }
                    }
                    rows.sort((a, b) -> Integer.compare((int) b.get("score"), (int) a.get("score")));
                    if (rows.size() > 60) rows = rows.subList(0, 60);
                    sendJson(exchange, 200, rows);
                    return;
                }

                if (path.startsWith("/api/drivers/")) {
                    int did = Integer.parseInt(path.substring("/api/drivers/".length()));
                    Map<String, Object> d = getDriverDetail(c, did);
                    if (d != null) {
                        sendJson(exchange, 200, d);
                    } else {
                        sendJson(exchange, 404, Map.of("error", "Not found"));
                    }
                    return;
                }

                if ("/api/violations".equals(path) && isPost) {
                    String vn = String.valueOf(body.getOrDefault("vehicle_number", "")).trim().toUpperCase();
                    String ty = String.valueOf(body.getOrDefault("violation_type", ""));
                    String loc = String.valueOf(body.getOrDefault("location", ""));
                    String vdate = String.valueOf(body.getOrDefault("violation_date", ""));
                    String vtime = String.valueOf(body.getOrDefault("violation_time", ""));
                    String evidence = String.valueOf(body.getOrDefault("evidence", ""));

                    int vehId = 0, driverId = 0;
                    try (PreparedStatement ps = c.prepareStatement("select * from vehicles where upper(vehicle_number)=?")) {
                        ps.setString(1, vn);
                        ResultSet rs = ps.executeQuery();
                        if (!rs.next()) {
                            sendJson(exchange, 400, Map.of("error", "Vehicle number not found. Check the registration number."));
                            return;
                        }
                        vehId = rs.getInt("vehicle_id");
                        driverId = rs.getInt("driver_id");
                    }

                    if (!TYPES.containsKey(ty)) {
                        sendJson(exchange, 400, Map.of("error", "Choose a violation type"));
                        return;
                    }
                    if (!LOCS.contains(loc)) {
                        sendJson(exchange, 400, Map.of("error", "Choose a location"));
                        return;
                    }

                    try {
                        LocalDate.parse(vdate);
                        LocalTime.parse(vtime);
                    } catch (Exception ex) {
                        sendJson(exchange, 400, Map.of("error", "Enter a valid date and time"));
                        return;
                    }

                    int beforeScore = calculateRisk(getViolationsForDriver(c, driverId)).score;
                    ViolationRule rule = TYPES.get(ty);

                    try (PreparedStatement ps = c.prepareStatement(
                            "insert into violations(driver_id,vehicle_id,officer_id,violation_type,location,violation_date,violation_time,severity,fine_amount,payment_status,evidence_reference,created_at) values(?,?,?,?,?,?,?,?,?,?,?,?)")) {
                        ps.setInt(1, driverId);
                        ps.setInt(2, vehId);
                        ps.setInt(3, me.id);
                        ps.setString(4, ty);
                        ps.setString(5, loc);
                        ps.setString(6, vdate);
                        ps.setString(7, vtime);
                        ps.setString(8, rule.severity);
                        ps.setInt(9, rule.fine);
                        ps.setString(10, "Pending");
                        ps.setString(11, evidence.length() > 80 ? evidence.substring(0, 80) : evidence);
                        ps.setString(12, now());
                        ps.executeUpdate();
                    }

                    RefreshAlertResult r = refreshAlerts(c, driverId);

                    Map<String, Object> resp = new LinkedHashMap<>();
                    resp.put("driver_id", driverId);
                    resp.put("fine", rule.fine);
                    resp.put("severity", rule.severity);
                    resp.put("before", beforeScore);
                    resp.put("after", r.risk.score);
                    resp.put("level", r.risk.level);
                    resp.put("new_alerts", r.newAlerts);
                    resp.put("patterns", r.risk.patterns);
                    sendJson(exchange, 200, resp);
                    return;
                }

                if ("/api/alerts".equals(path)) {
                    // Smart Alert Prioritization: score every alert, push it onto a
                    // max-heap (java.util.PriorityQueue) whose ordering comes from a
                    // Comparator, then poll() the heap so the most important alert
                    // is served first.
                    PriorityQueue<AlertItem> pq = new PriorityQueue<>(
                            Comparator.<AlertItem>comparingInt(a -> a.priority)
                                    .reversed()                                                   // highest priority first
                                    .thenComparing(a -> a.createdAt, Comparator.reverseOrder())); // tie-break: newest first

                    try (Statement st = c.createStatement();
                         ResultSet rs = st.executeQuery(
                                 "select a.*, d.name as driver_name from alerts a join drivers d on d.driver_id=a.driver_id order by a.alert_id desc limit 150")) {
                        while (rs.next()) {
                            AlertItem a = new AlertItem();
                            a.alertId = rs.getInt("alert_id");
                            a.driverId = rs.getInt("driver_id");
                            a.driverName = rs.getString("driver_name");
                            a.alertType = rs.getString("alert_type");
                            a.message = rs.getString("message");
                            a.severity = rs.getString("severity");
                            a.createdAt = rs.getString("created_at");
                            a.status = rs.getString("status");
                            a.riskScore = calculateRisk(getViolationsForDriver(c, a.driverId)).score;
                            a.urgency = urgencyScore(a.createdAt, !"Reviewed".equals(a.status));
                            a.priority = alertPriority(a.severity, a.riskScore, a.urgency);
                            a.priorityLabel = priorityLabel(a.priority);
                            pq.offer(a);
                        }
                    }

                    // Dynamic location hotspot alerts are scored and join the same queue.
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> byLoc = (List<Map<String, Object>>) getAnalytics(c).get("by_location");
                    for (Map<String, Object> l : byLoc) {
                        if (Boolean.TRUE.equals(l.get("hotspot"))) {
                            AlertItem a = new AlertItem();
                            a.alertId = 0;
                            a.driverId = null;
                            a.driverName = (String) l.get("location");
                            a.alertType = "Location Hotspot";
                            a.severity = "Medium";
                            a.status = "Info";
                            a.createdAt = now();
                            a.message = l.get("location") + " has " + l.get("count") +
                                    " recorded violations, above the hotspot threshold. Most common: " + l.get("top_type") + ".";
                            a.riskScore = 0;
                            a.urgency = urgencyScore(a.createdAt, true);
                            a.priority = alertPriority(a.severity, a.riskScore, a.urgency);
                            a.priorityLabel = priorityLabel(a.priority);
                            pq.offer(a);
                        }
                    }

                    // Drain the heap: poll() hands back the highest-priority alert
                    // on every call, so the response is ordered by importance.
                    List<Map<String, Object>> rows = new ArrayList<>();
                    while (!pq.isEmpty()) {
                        AlertItem a = pq.poll();
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("alert_id", a.alertId);
                        m.put("driver_id", a.driverId);
                        m.put("driver_name", a.driverName);
                        m.put("alert_type", a.alertType);
                        m.put("message", a.message);
                        m.put("severity", a.severity);
                        m.put("created_at", a.createdAt);
                        m.put("status", a.status);
                        m.put("priority", a.priority);
                        m.put("priority_label", a.priorityLabel);
                        m.put("risk_score", a.riskScore);
                        m.put("urgency", a.urgency);
                        rows.add(m);
                    }
                    sendJson(exchange, 200, rows);
                    return;
                }

                if (path.startsWith("/api/alerts/") && path.endsWith("/ack") && isPost) {
                    String[] parts = path.split("/");
                    int aid = Integer.parseInt(parts[3]);
                    try (PreparedStatement ps = c.prepareStatement("update alerts set status='Reviewed' where alert_id=?")) {
                        ps.setInt(1, aid);
                        ps.executeUpdate();
                    }
                    sendJson(exchange, 200, Map.of("ok", true));
                    return;
                }

                if ("/api/whatif".equals(path)) {
                    String scenario = q.get("scenario");
                    String location = q.get("location");
                    int[] sc = SCEN.get(scenario);

                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> byLoc = (List<Map<String, Object>>) getAnalytics(c).get("by_location");
                    Map<String, Object> l = byLoc.stream()
                            .filter(x -> Objects.equals(x.get("location"), location))
                            .findFirst()
                            .orElse(null);

                    if (sc == null || l == null) {
                        sendJson(exchange, 400, Map.of("error", "Choose a location and scenario"));
                        return;
                    }

                    long n = (long) l.get("count");
                    Map<String, Object> resp = new LinkedHashMap<>();
                    resp.put("location", l.get("location"));
                    resp.put("baseline", n);
                    resp.put("low_pct", sc[0]);
                    resp.put("high_pct", sc[1]);
                    resp.put("est_low", Math.round(n * (1.0 - (double) sc[1] / 100.0)));
                    resp.put("est_high", Math.round(n * (1.0 - (double) sc[0] / 100.0)));
                    resp.put("note", "Historical-data-based estimate; not a guaranteed prediction.");
                    sendJson(exchange, 200, resp);
                    return;
                }

                if ("/api/report".equals(path)) {
                    String kind = q.getOrDefault("kind", "summary");
                    String idArg = q.get("id");
                    String text = generateReport(c, kind, idArg);
                    String ctype = "csv".equals(kind) ? "text/csv" : "text/plain";
                    send(exchange, 200, text.getBytes(StandardCharsets.UTF_8), ctype);
                    return;
                }

                sendJson(exchange, 404, Map.of("error", "Not found"));
            } catch (Exception ex) {
                ex.printStackTrace();
                sendJson(exchange, 500, Map.of("error", ex.getMessage() != null ? ex.getMessage() : "Internal Error"));
            }
        }

        private SessionUser getUser(HttpExchange ex) {
            String auth = ex.getRequestHeaders().getFirst("Authorization");
            if (auth == null || !auth.startsWith("Bearer ")) return null;
            String token = auth.substring("Bearer ".length()).trim();
            return SESS.get(token);
        }

        private void sendJson(HttpExchange ex, int code, Object data) throws IOException {
            byte[] bytes = Json.stringify(data).getBytes(StandardCharsets.UTF_8);
            send(ex, code, bytes, "application/json");
        }

        private void send(HttpExchange ex, int code, byte[] body, String ctype) throws IOException {
            ex.getResponseHeaders().set("Content-Type", ctype + "; charset=utf-8");
            ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
            ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            ex.sendResponseHeaders(code, body.length);
            try (OutputStream os = ex.getResponseBody()) {
                os.write(body);
            }
        }

        private String readBody(HttpExchange ex) throws IOException {
            try (InputStream is = ex.getRequestBody()) {
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] data = new byte[1024];
                int nRead;
                while ((nRead = is.read(data, 0, data.length)) != -1) {
                    buffer.write(data, 0, nRead);
                }
                return buffer.toString(StandardCharsets.UTF_8);
            }
        }

        private Map<String, String> parseQuery(String query) {
            Map<String, String> map = new LinkedHashMap<>();
            if (query == null || query.isEmpty()) return map;
            for (String param : query.split("&")) {
                String[] pair = param.split("=");
                try {
                    String key = URLDecoder.decode(pair[0], StandardCharsets.UTF_8);
                    String val = pair.length > 1 ? URLDecoder.decode(pair[1], StandardCharsets.UTF_8) : "";
                    map.put(key, val);
                } catch (Exception ignored) {}
            }
            return map;
        }
    }

    // =========================================================================
    // MAIN ENTRYPOINT
    // =========================================================================
    public static void main(String[] args) throws IOException {
        seed();

        int port = 8000;
        String portEnv = System.getenv("PORT");
        if (portEnv != null) {
            try { port = Integer.parseInt(portEnv); } catch (Exception ignored) {}
        }

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/", new ApiHandler());
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();

        System.out.println("==================================================================");
        System.out.println(" Roadwise Traffic Violation Prevention & Analytics Backend (Java)");
        System.out.println(" Running on: http://localhost:" + port);
        System.out.println(" Demo logins: admin / admin123  |  officer / officer123");
        System.out.println(" SQLite Database: " + DB_PATH);
        System.out.println("==================================================================");
    }
}
