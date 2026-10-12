import React from "react";

export default function StructuredData() {
  const baseUrl = "https://smarttraffic-analytics.vercel.app";

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SmartTraffic Analytics",
    url: baseUrl,
    description:
      "Academic project team behind the Smart Traffic Violation Prevention & Management System, a JavaFX and MySQL decision-support application for traffic violation analytics.",
    sameAs: ["https://github.com/placeholder/smarttraffic-analytics"]
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "SmartTraffic Analytics",
    url: baseUrl,
    description:
      "Project site for the Smart Traffic Violation Prevention & Management System: explainable driver risk scoring, repeated-pattern detection, hotspot and time analysis, and evidence-backed alerts.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${baseUrl}/dashboard?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Smart Traffic Violation Prevention & Management System",
    alternateName: "SmartTraffic Analytics",
    url: `${baseUrl}/dashboard`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Java 17+, MySQL 8, Windows, Linux, macOS",
    description:
      "A JavaFX desktop decision-support application for managing traffic violations and extracting behavioural and traffic-pattern insights from violation history. Provides an explainable driver risk score, repeated-violation and temporal pattern detection, location hotspot analysis, time-of-day analysis, trend and improvement tracking, evidence-backed alerts, and historical-data-based what-if analysis.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Does this project replace the eChallan platform?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. India's official eChallan platform already digitises challan creation, violation history, penalty calculation, location capture, dashboards, reports, alerts and payment workflows. This project is an additional explainable behavioural and preventive analytics layer built on top of violation records."
        }
      },
      {
        "@type": "Question",
        name: "How is the driver risk score calculated?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The risk score is a weighted sum of four normalised 0-100 components: 30% violation frequency, 25% recent violation activity, 25% repeat violation rate and 20% severity factor. The result is banded as LOW (0-30), MEDIUM (31-60), HIGH (61-80) or CRITICAL (81-100), and the interface shows the raw value, weight and explanation for every factor."
        }
      },
      {
        "@type": "Question",
        name: "Does the system punish or suspend drivers automatically?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. The system never applies an automatic penalty, licence suspension or legal classification. It produces evidence-backed alerts and recommendations for an authorised officer or administrator to review."
        }
      },
      {
        "@type": "Question",
        name: "What is the what-if analysis and how reliable is it?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The what-if screen applies a hypothetical intervention, such as extra enforcement at a hotspot, to the historical record and reports the modelled result. It is labelled scenario analysis and an estimate, never a guaranteed prediction."
        }
      },
      {
        "@type": "Question",
        name: "Which roles can use the system?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Three roles: Administrator, Traffic Officer and Analyst. Officers register violations and review risk breakdowns, administrators manage accounts and configure scoring parameters, and analysts have read-only access to every analytics surface for transparency and audit."
        }
      }
    ]
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Project Overview",
        item: baseUrl
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Console Login",
        item: `${baseUrl}/auth`
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Officer Console",
        item: `${baseUrl}/dashboard`
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Analytics Placeholders (GA4, Clarity) */}
      {process.env.NEXT_PUBLIC_GA_ID && (
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
        />
      )}
      {process.env.NEXT_PUBLIC_CLARITY_ID && (
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_ID}");`
          }}
        />
      )}
    </>
  );
}
