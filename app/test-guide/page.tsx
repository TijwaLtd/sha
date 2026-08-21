import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CheckCircle2,
  AlertTriangle,
  Shield,
  FileWarning,
  XCircle,
  ArrowRight,
  Clock,
} from "lucide-react"

type Severity = "none" | "warning" | "danger"

type TestCase = {
  name: string
  diagnosis: string
  items: { service: string; qty: number; amountKes: number }[]
  expected: string
  severity: Severity
  note?: string
}

type HospitalTestGroup = {
  id: string
  name: string
  tier: string
  county: string
  email: string
  status: "VERIFIED" | "UNVERIFIED" | "PENDING" | "SUSPENDED" | "INACTIVE"
  facilityLevel: number
  services: string[]
  testCases: TestCase[]
}

const AMOUNT_THRESHOLD_KES = 750_000
const QTY_THRESHOLD = 10

const hospitals: HospitalTestGroup[] = [
  // ── Dispensaries (Level 1) ──
  {
    id: "kibera",
    name: "Kibera Community Dispensary",
    tier: "Level 1 — Dispensary",
    county: "Nairobi",
    email: "faith@kiberadispensary.co.ke",
    status: "UNVERIFIED",
    facilityLevel: 1,
    services: ["CONSULTATION", "PHARMACY", "IMMUNIZATION", "FAMILY_PLANNING", "MALARIA_TEST"],
    testCases: [
      {
        name: "Unverified facility",
        diagnosis: "Common cold",
        items: [{ service: "CONSULTATION", qty: 1, amountKes: 150 }],
        expected: "R-001 triggers — FLAGGED (score 50)",
        severity: "danger",
        note: "Facility is UNVERIFIED — any claim triggers R-001",
      },
      {
        name: "Service mismatch — dispensary bills X-ray",
        diagnosis: "Suspected wrist fracture",
        items: [
          { service: "CONSULTATION", qty: 1, amountKes: 150 },
          { service: "X_RAY", qty: 1, amountKes: 1500 },
        ],
        expected: "R-001 + R-002 trigger — FLAGGED (score 100)",
        severity: "danger",
        note: "X-ray not authorized at dispensary level AND facility unverified",
      },
    ],
  },
  {
    id: "kitale",
    name: "Kitale Central Dispensary",
    tier: "Level 1 — Dispensary",
    county: "Trans-Nzoia",
    email: "peter@kitaledispensary.co.ke",
    status: "VERIFIED",
    facilityLevel: 1,
    services: ["CONSULTATION", "PHARMACY", "IMMUNIZATION", "FAMILY_PLANNING", "MALARIA_TEST"],
    testCases: [
      {
        name: "Clean claim",
        diagnosis: "Malaria — uncomplicated",
        items: [
          { service: "CONSULTATION", qty: 1, amountKes: 150 },
          { service: "MALARIA_TEST", qty: 1, amountKes: 200 },
          { service: "PHARMACY", qty: 1, amountKes: 300 },
        ],
        expected: "CLEARED — no rules trigger",
        severity: "none",
      },
      {
        name: "Service mismatch — dispensary bills specialist consult",
        diagnosis: "Chest pain — needs specialist",
        items: [{ service: "SPECIALIST_CONSULT", qty: 1, amountKes: 1000 }],
        expected: "R-002 triggers — FLAGGED (score 50)",
        severity: "danger",
        note: "Specialist consult not available at dispensary",
      },
    ],
  },
  {
    id: "bungoma",
    name: "Bungoma Rural Dispensary",
    tier: "Level 1 — Dispensary",
    county: "Bungoma",
    email: "grace@bungomadispensary.co.ke",
    status: "PENDING",
    facilityLevel: 1,
    services: ["CONSULTATION", "PHARMACY", "IMMUNIZATION", "FAMILY_PLANNING", "MALARIA_TEST"],
    testCases: [
      {
        name: "Pending verification",
        diagnosis: "Upper respiratory infection",
        items: [{ service: "CONSULTATION", qty: 1, amountKes: 150 }],
        expected: "R-001 triggers — FLAGGED (score 50)",
        severity: "danger",
        note: "PENDING verification treated as not verified",
      },
    ],
  },

  // ── Health Centres (Level 2) ──
  {
    id: "machakos-hc",
    name: "Machakos Town Health Centre",
    tier: "Level 2 — Health Centre",
    county: "Machakos",
    email: "josephine@machakoshc.co.ke",
    status: "VERIFIED",
    facilityLevel: 2,
    services: [
      "CONSULTATION", "PHARMACY", "MALARIA_TEST", "CBC", "URINALYSIS",
      "ANC", "DELIVERY_NORMAL", "POSTNATAL", "IMMUNIZATION", "FAMILY_PLANNING",
      "X_RAY", "ULTRASOUND",
    ],
    testCases: [
      {
        name: "Clean maternity claim",
        diagnosis: "Routine antenatal visit",
        items: [
          { service: "ANC", qty: 1, amountKes: 500 },
          { service: "CONSULTATION", qty: 1, amountKes: 200 },
        ],
        expected: "CLEARED — no rules trigger",
        severity: "none",
      },
      {
        name: "Service mismatch — health centre bills CT scan",
        diagnosis: "Head injury — needs imaging",
        items: [{ service: "CT_SCAN", qty: 1, amountKes: 8000 }],
        expected: "R-002 triggers — FLAGGED (score 50)",
        severity: "danger",
        note: "CT scan not available at health centre level",
      },
    ],
  },
  {
    id: "kakamega-hc",
    name: "Kakamega Health Centre",
    tier: "Level 2 — Health Centre",
    county: "Kakamega",
    email: "mercy@kakamegahc.co.ke",
    status: "VERIFIED",
    facilityLevel: 2,
    services: [
      "CONSULTATION", "PHARMACY", "MALARIA_TEST", "CBC", "URINALYSIS",
      "ANC", "DELIVERY_NORMAL", "POSTNATAL", "IMMUNIZATION", "FAMILY_PLANNING",
      "X_RAY", "ULTRASOUND",
    ],
    testCases: [
      {
        name: "Unusual quantity — bulk pharmacy",
        diagnosis: "Normal delivery with extended pharmacy supply",
        items: [
          { service: "DELIVERY_NORMAL", qty: 1, amountKes: 20000 },
          { service: "PHARMACY", qty: 14, amountKes: 400 },
        ],
        expected: "R-005 triggers (qty > 10) — CLEARED (score 10)",
        severity: "warning",
        note: "Pharmacy qty 14 exceeds threshold but single rule score is below flag threshold",
      },
    ],
  },
  {
    id: "lamu",
    name: "Lamu Island Health Centre",
    tier: "Level 2 — Health Centre",
    county: "Lamu",
    email: "mercy@lamuhc.co.ke",
    status: "UNVERIFIED",
    facilityLevel: 2,
    services: [
      "CONSULTATION", "PHARMACY", "MALARIA_TEST", "CBC", "URINALYSIS",
      "ANC", "DELIVERY_NORMAL", "POSTNATAL", "IMMUNIZATION", "FAMILY_PLANNING",
      "X_RAY", "ULTRASOUND",
    ],
    testCases: [
      {
        name: "Unverified facility",
        diagnosis: "Malaria test needed",
        items: [{ service: "MALARIA_TEST", qty: 1, amountKes: 300 }],
        expected: "R-001 triggers — FLAGGED (score 50)",
        severity: "danger",
        note: "Health centre is UNVERIFIED",
      },
    ],
  },

  // ── Sub-County Hospitals (Level 3) ──
  {
    id: "kiambu",
    name: "Kiambu Sub-County Hospital",
    tier: "Level 3 — Sub-County Hospital",
    county: "Kiambu",
    email: "daniel@kiambuscsh.go.ke",
    status: "VERIFIED",
    facilityLevel: 3,
    services: [
      "CONSULTATION", "SPECIALIST_CONSULT", "PHARMACY", "MALARIA_TEST", "CBC",
      "URINALYSIS", "BLOOD_CHEM", "X_RAY", "ULTRASOUND", "ANC", "DELIVERY_NORMAL",
      "DELIVERY_CS", "POSTNATAL", "SURGERY_MINOR", "DENTAL", "EMERGENCY",
    ],
    testCases: [
      {
        name: "Clean claim",
        diagnosis: "Malaria — uncomplicated",
        items: [
          { service: "CONSULTATION", qty: 1, amountKes: 500 },
          { service: "MALARIA_TEST", qty: 1, amountKes: 500 },
          { service: "PHARMACY", qty: 1, amountKes: 800 },
        ],
        expected: "CLEARED — no rules trigger",
        severity: "none",
      },
      {
        name: "Service mismatch — sub-county bills CT scan",
        diagnosis: "Head injury — CT requested",
        items: [
          { service: "CONSULTATION", qty: 1, amountKes: 500 },
          { service: "CT_SCAN", qty: 1, amountKes: 8000 },
        ],
        expected: "R-002 triggers — FLAGGED (score 50)",
        severity: "danger",
        note: "CT scan not allowed at sub-county level",
      },
    ],
  },
  {
    id: "machakos-sc",
    name: "Machakos Sub-County Hospital",
    tier: "Level 3 — Sub-County Hospital",
    county: "Machakos",
    email: "grace@machakosscsh.go.ke",
    status: "VERIFIED",
    facilityLevel: 3,
    services: [
      "CONSULTATION", "SPECIALIST_CONSULT", "PHARMACY", "MALARIA_TEST", "CBC",
      "URINALYSIS", "BLOOD_CHEM", "X_RAY", "ULTRASOUND", "ANC", "DELIVERY_NORMAL",
      "DELIVERY_CS", "POSTNATAL", "SURGERY_MINOR", "DENTAL", "EMERGENCY",
    ],
    testCases: [
      {
        name: "Clean claim — specialist consultation",
        diagnosis: "Diabetes follow-up",
        items: [
          { service: "SPECIALIST_CONSULT", qty: 1, amountKes: 800 },
          { service: "BLOOD_CHEM", qty: 1, amountKes: 500 },
          { service: "PHARMACY", qty: 1, amountKes: 600 },
        ],
        expected: "CLEARED — all services authorized",
        severity: "none",
      },
    ],
  },
  {
    id: "siaya",
    name: "Siaya Sub-County Hospital",
    tier: "Level 3 — Sub-County Hospital (Suspended)",
    county: "Siaya",
    email: "david@siayascsh.go.ke",
    status: "SUSPENDED",
    facilityLevel: 3,
    services: [
      "CONSULTATION", "SPECIALIST_CONSULT", "PHARMACY", "MALARIA_TEST", "CBC",
      "URINALYSIS", "BLOOD_CHEM", "X_RAY", "ULTRASOUND", "ANC", "DELIVERY_NORMAL",
      "DELIVERY_CS", "POSTNATAL", "SURGERY_MINOR", "DENTAL", "EMERGENCY",
    ],
    testCases: [
      {
        name: "Suspended facility — any claim",
        diagnosis: "Any condition",
        items: [{ service: "CONSULTATION", qty: 1, amountKes: 500 }],
        expected: "R-001 triggers — FLAGGED (score 50)",
        severity: "danger",
        note: "Suspended facility with REJECTED verification",
      },
    ],
  },

  // ── County Referral Hospitals (Level 4) ──
  {
    id: "nakuru",
    name: "Nakuru County Referral Hospital",
    tier: "Level 4 — County Referral Hospital",
    county: "Nakuru",
    email: "esther@nakurureferral.go.ke",
    status: "VERIFIED",
    facilityLevel: 4,
    services: [
      "CONSULTATION", "SPECIALIST_CONSULT", "PHARMACY", "MALARIA_TEST", "CBC",
      "URINALYSIS", "BLOOD_CHEM", "HIV_TEST", "TB_SCREEN", "BLOOD_GROUP",
      "X_RAY", "ULTRASOUND", "CT_SCAN", "SURGERY_MINOR", "SURGERY_MAJOR",
      "ORTHO_SURGERY", "ANC", "DELIVERY_NORMAL", "DELIVERY_CS", "POSTNATAL",
      "DENTAL", "EMERGENCY", "AMBULANCE", "ICU", "PHYSIOTHERAPY", "MENTAL_HEALTH",
    ],
    testCases: [
      {
        name: "Clean claim — diabetes workup",
        diagnosis: "Type 2 diabetes — routine workup",
        items: [
          { service: "SPECIALIST_CONSULT", qty: 1, amountKes: 1000 },
          { service: "BLOOD_CHEM", qty: 1, amountKes: 1500 },
          { service: "PHARMACY", qty: 1, amountKes: 2000 },
        ],
        expected: "CLEARED — no rules trigger",
        severity: "none",
      },
      {
        name: "High amount — complex surgery + ICU",
        diagnosis: "Complex orthopedic surgery with prolonged ICU stay",
        items: [
          { service: "ORTHO_SURGERY", qty: 1, amountKes: 450000 },
          { service: "ICU", qty: 12, amountKes: 15000 },
          { service: "SURGERY_MAJOR", qty: 1, amountKes: 200000 },
        ],
        expected: "R-004 triggers — CLEARED (score 15)",
        severity: "warning",
        note: "Total KES 830,000 exceeds threshold but single rule score below flag threshold",
      },
    ],
  },
  {
    id: "kakamega-cr",
    name: "Kakamega County Referral Hospital",
    tier: "Level 4 — County Referral Hospital",
    county: "Kakamega",
    email: "nasra@kakamegareferral.go.ke",
    status: "VERIFIED",
    facilityLevel: 4,
    services: [
      "CONSULTATION", "SPECIALIST_CONSULT", "PHARMACY", "MALARIA_TEST", "CBC",
      "URINALYSIS", "BLOOD_CHEM", "HIV_TEST", "TB_SCREEN", "BLOOD_GROUP",
      "X_RAY", "ULTRASOUND", "CT_SCAN", "SURGERY_MINOR", "SURGERY_MAJOR",
      "ORTHO_SURGERY", "ANC", "DELIVERY_NORMAL", "DELIVERY_CS", "POSTNATAL",
      "DENTAL", "EMERGENCY", "AMBULANCE", "ICU", "PHYSIOTHERAPY", "MENTAL_HEALTH",
    ],
    testCases: [
      {
        name: "Clean claim — emergency surgery",
        diagnosis: "Appendicitis — emergency",
        items: [
          { service: "EMERGENCY", qty: 1, amountKes: 2000 },
          { service: "SURGERY_MINOR", qty: 1, amountKes: 50000 },
          { service: "PHARMACY", qty: 1, amountKes: 3000 },
        ],
        expected: "CLEARED — all services authorized",
        severity: "none",
      },
    ],
  },
  {
    id: "garissa",
    name: "Garissa County Referral Hospital",
    tier: "Level 4 — County Referral Hospital",
    county: "Garissa",
    email: "abdi@garissareferral.go.ke",
    status: "PENDING",
    facilityLevel: 4,
    services: [
      "CONSULTATION", "SPECIALIST_CONSULT", "PHARMACY", "MALARIA_TEST", "CBC",
      "URINALYSIS", "BLOOD_CHEM", "HIV_TEST", "TB_SCREEN", "BLOOD_GROUP",
      "X_RAY", "ULTRASOUND", "CT_SCAN", "SURGERY_MINOR", "SURGERY_MAJOR",
      "ORTHO_SURGERY", "ANC", "DELIVERY_NORMAL", "DELIVERY_CS", "POSTNATAL",
      "DENTAL", "EMERGENCY", "AMBULANCE", "ICU", "PHYSIOTHERAPY", "MENTAL_HEALTH",
    ],
    testCases: [
      {
        name: "Pending verification",
        diagnosis: "Malaria — complicated",
        items: [
          { service: "MALARIA_TEST", qty: 1, amountKes: 500 },
          { service: "CBC", qty: 1, amountKes: 500 },
          { service: "PHARMACY", qty: 1, amountKes: 1000 },
        ],
        expected: "R-001 triggers — FLAGGED (score 50)",
        severity: "danger",
        note: "PENDING verification treated as not verified",
      },
    ],
  },

  // ── National Referral Hospitals (Level 5) ──
  {
    id: "eldoret",
    name: "Eldoret National Referral Hospital",
    tier: "Level 5 — National Referral Hospital",
    county: "Uasin Gishu",
    email: "kiplangat@eldoretnrh.go.ke",
    status: "VERIFIED",
    facilityLevel: 5,
    services: ["ALL SERVICES"],
    testCases: [
      {
        name: "Clean claim — dialysis",
        diagnosis: "Renal failure — dialysis sessions",
        items: [
          { service: "DIALYSIS", qty: 8, amountKes: 10000 },
          { service: "BLOOD_CHEM", qty: 1, amountKes: 1500 },
          { service: "CONSULTATION", qty: 1, amountKes: 2000 },
        ],
        expected: "CLEARED — no rules trigger",
        severity: "none",
      },
      {
        name: "Critical amount — multi-organ trauma",
        diagnosis: "Multi-organ trauma — emergency major surgery",
        items: [
          { service: "SURGERY_MAJOR", qty: 2, amountKes: 400000 },
          { service: "ICU", qty: 20, amountKes: 20000 },
          { service: "AMBULANCE", qty: 1, amountKes: 5000 },
        ],
        expected: "R-004 + R-005 trigger — CLEARED (score 25)",
        severity: "warning",
        note: "Total KES 1,205,000 exceeds threshold but combined score below flag threshold",
      },
    ],
  },
  {
    id: "nairobi-nrh",
    name: "Nairobi National Referral Hospital",
    tier: "Level 5 — National Referral Hospital",
    county: "Nairobi",
    email: "james@nairobinrh.go.ke",
    status: "VERIFIED",
    facilityLevel: 5,
    services: ["ALL SERVICES"],
    testCases: [
      {
        name: "Clean claim — chemotherapy",
        diagnosis: "Breast cancer — chemotherapy cycle",
        items: [
          { service: "CHEMOTHERAPY", qty: 1, amountKes: 50000 },
          { service: "SPECIALIST_CONSULT", qty: 1, amountKes: 2000 },
          { service: "CBC", qty: 1, amountKes: 500 },
        ],
        expected: "CLEARED — all services authorized",
        severity: "none",
      },
    ],
  },
  {
    id: "coast-nrh",
    name: "Coast National Referral Hospital",
    tier: "Level 5 — National Referral Hospital (Inactive)",
    county: "Mombasa",
    email: "amina@coastnrh.go.ke",
    status: "INACTIVE",
    facilityLevel: 5,
    services: ["ALL SERVICES"],
    testCases: [
      {
        name: "Inactive facility",
        diagnosis: "Any condition",
        items: [{ service: "CONSULTATION", qty: 1, amountKes: 2000 }],
        expected: "R-001 triggers — FLAGGED (score 50)",
        severity: "danger",
        note: "INACTIVE facility status",
      },
    ],
  },
]

const demoAccounts = [
  // Hospital users
  ...hospitals.map((h) => ({
    email: h.email,
    hospital: h.name,
    role: "Hospital User" as const,
    level: h.tier,
  })),
  // SHA staff
  { email: "sarah@sha.go.ke", hospital: "SHA Office", role: "SHA Officer" as const, level: "—" },
  { email: "michael@sha.go.ke", hospital: "SHA Office", role: "SHA Officer" as const, level: "—" },
  { email: "admin@sha.go.ke", hospital: "SHA Office", role: "Admin" as const, level: "—" },
]

const password = "password"

export default function TestGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="container py-8">
          <h1 className="text-3xl font-bold">SHA Compliance — Test Guide</h1>
          <p className="mt-2 text-primary-foreground/80">
            Step-by-step test scenarios across {hospitals.length} facilities,
            from dispensary to national referral hospital
          </p>
        </div>
      </header>

      <main className="container space-y-8 py-8">
        {/* How Detection Works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              How Detection Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">1. Hospital Creates Claim</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hospital user creates a draft claim, adds line items, and
                  submits. No validation at this stage.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">2. Compliance Rules</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Base rules (R-001 to R-007) check facility verification,
                  service authorization, duplicates, amounts.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">3. Contextual Analysis</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Equipment, tariff, capacity, billing, and patient history
                  checks (R-007 to R-016) run against the claim.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">4. Risk & Alert</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Risk score calculated. Score ≥ 50 → FLAGGED → alert
                  generated for investigation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demo Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Demo Accounts</CardTitle>
            <CardDescription>
              All accounts use password:{" "}
              <code className="rounded bg-muted px-1">{password}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {demoAccounts.map((account) => (
                <div key={account.email} className="rounded-lg border p-3">
                  <div className="font-medium">{account.hospital}</div>
                  <div className="text-sm text-muted-foreground">
                    {account.role}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {account.level}
                  </div>
                  <code className="mt-1 block text-xs text-muted-foreground">
                    {account.email}
                  </code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Hospital Test Cases */}
        <div className="space-y-6">
          {hospitals.map((hospital) => {
            const StatusIcon =
              hospital.status === "VERIFIED"
                ? CheckCircle2
                : hospital.status === "SUSPENDED" || hospital.status === "INACTIVE"
                  ? XCircle
                  : AlertTriangle
            const statusColor =
              hospital.status === "VERIFIED"
                ? "text-green-600"
                : hospital.status === "SUSPENDED" || hospital.status === "INACTIVE"
                  ? "text-red-600"
                  : "text-orange-600"

            return (
              <Card key={hospital.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-6 w-6 ${statusColor}`} />
                      <div>
                        <CardTitle>{hospital.name}</CardTitle>
                        <CardDescription>
                          {hospital.tier} · {hospital.county} ·{" "}
                          <code className="text-xs">{hospital.email}</code>
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={
                        hospital.status === "VERIFIED"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {hospital.status}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div className="text-sm font-medium">
                      Authorized Services:
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {hospital.services.length > 0 ? (
                        hospital.services.map((s) => (
                          <Badge key={s} variant="outline">
                            {s}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          None (suspended)
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test Case</TableHead>
                        <TableHead>What to Bill</TableHead>
                        <TableHead>Expected Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hospital.testCases.map((tc, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="font-medium">{tc.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Diagnosis: {tc.diagnosis}
                            </div>
                            {tc.note && (
                              <div className="mt-1 text-xs text-orange-600">
                                {tc.note}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {tc.items.map((item, i) => (
                              <div key={i} className="text-sm">
                                {item.service} × {item.qty} @ KES{" "}
                                {item.amountKes.toLocaleString()}
                              </div>
                            ))}
                            <div className="mt-1 text-sm font-medium">
                              Total: KES{" "}
                              {tc.items
                                .reduce(
                                  (sum, item) =>
                                    sum + item.qty * item.amountKes,
                                  0
                                )
                                .toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                tc.severity === "none"
                                  ? "secondary"
                                  : tc.severity === "warning"
                                    ? "default"
                                    : "destructive"
                              }
                            >
                              {tc.expected}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 flex gap-2">
                    <Link
                      href="/login"
                      className={buttonVariants({ size: "sm" })}
                    >
                      Login as {hospital.name.split(" ")[0]}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Moving Patient Scenarios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Cross-Facility Duplicate Scenarios
            </CardTitle>
            <CardDescription>
              Two patients with claims across multiple facilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4">
              <h4 className="font-semibold">Patient A — PAT-SYN-201</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Same patient billed for CT scan at two different facilities
                within 5 days. Triggers R-007 (Cross-Facility Duplicate).
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded border p-2 text-sm">
                  <strong>Claim 1:</strong> Nakuru County Referral — CT scan
                  KES 8,000 (Aug 11)
                </div>
                <div className="rounded border p-2 text-sm">
                  <strong>Claim 2:</strong> Eldoret National Referral — CT scan
                  KES 10,000 (Aug 12)
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="font-semibold">Patient B — PAT-SYN-202</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Dispensary bills X-ray (outside scope), then legitimate
                referral at sub-county hospital. Tests scope breach detection
                vs. legitimate referrals.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded border p-2 text-sm">
                  <strong>Claim 1:</strong> Kibera Dispensary — X-ray KES
                  1,500 (Aug 13) — FLAGGED (scope breach)
                </div>
                <div className="rounded border p-2 text-sm">
                  <strong>Claim 2:</strong> Kiambu Sub-County — X-ray + surgery
                  KES 9,500 (Aug 15) — UNDER_REVIEW
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Rules Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5" />
              Compliance Rules Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell><Badge>R-001</Badge></TableCell>
                  <TableCell>Facility Not Verified</TableCell>
                  <TableCell>verificationStatus ≠ VERIFIED</TableCell>
                  <TableCell><Badge variant="destructive">+50</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge>R-002</Badge></TableCell>
                  <TableCell>Service Mismatch</TableCell>
                  <TableCell>Service not in hospital&apos;s authorized list</TableCell>
                  <TableCell><Badge variant="destructive">+50</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge>R-003</Badge></TableCell>
                  <TableCell>Same-Facility Duplicate</TableCell>
                  <TableCell>Same patient, same service, same facility within 5 days</TableCell>
                  <TableCell><Badge>+30</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge>R-004</Badge></TableCell>
                  <TableCell>Unusual Amount</TableCell>
                  <TableCell>Total &gt; KES {AMOUNT_THRESHOLD_KES.toLocaleString()}</TableCell>
                  <TableCell><Badge variant="default">+15</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge>R-005</Badge></TableCell>
                  <TableCell>Unusual Quantity</TableCell>
                  <TableCell>Any item qty &gt; {QTY_THRESHOLD}</TableCell>
                  <TableCell><Badge variant="default">+10</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge>R-006</Badge></TableCell>
                  <TableCell>Diagnosis Mismatch</TableCell>
                  <TableCell><span className="text-muted-foreground">Not implemented</span></TableCell>
                  <TableCell><Badge>+20</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge>R-007</Badge></TableCell>
                  <TableCell>Cross-Facility Duplicate</TableCell>
                  <TableCell>Same patient, same service, different facility within 5 days</TableCell>
                  <TableCell><Badge variant="destructive">+35</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="secondary">R-008</Badge></TableCell>
                  <TableCell>Equipment Unavailable</TableCell>
                  <TableCell>Required equipment not operational at facility</TableCell>
                  <TableCell><Badge>+20</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="secondary">R-009</Badge></TableCell>
                  <TableCell>Equipment Capacity Exceeded</TableCell>
                  <TableCell>Claimed quantity exceeds operational equipment count</TableCell>
                  <TableCell><Badge>+15</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="secondary">R-010</Badge></TableCell>
                  <TableCell>Tariff Exceeded</TableCell>
                  <TableCell>Unit amount exceeds maximum tariff for service/level</TableCell>
                  <TableCell><Badge>+15</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="secondary">R-011</Badge></TableCell>
                  <TableCell>Service Not Accredited</TableCell>
                  <TableCell>Hospital not accredited for claimed service</TableCell>
                  <TableCell><Badge>+25</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="secondary">R-012</Badge></TableCell>
                  <TableCell>Patient Service Frequency</TableCell>
                  <TableCell>Same patient, same service 5+ times in 90 days</TableCell>
                  <TableCell><Badge>+20</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="secondary">R-013</Badge></TableCell>
                  <TableCell>Patient Spending Anomaly</TableCell>
                  <TableCell>Patient cumulative spending exceeds KES 50,000</TableCell>
                  <TableCell><Badge>+15</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="secondary">R-014</Badge></TableCell>
                  <TableCell>Daily Billing Limit</TableCell>
                  <TableCell>Hospital daily billing total exceeds policy limit</TableCell>
                  <TableCell><Badge>+20</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="secondary">R-015</Badge></TableCell>
                  <TableCell>Monthly Billing Limit</TableCell>
                  <TableCell>Hospital monthly billing total exceeds policy limit</TableCell>
                  <TableCell><Badge>+15</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge variant="secondary">R-016</Badge></TableCell>
                  <TableCell>Facility Level Mismatch</TableCell>
                  <TableCell>Service not allowed for facility level</TableCell>
                  <TableCell><Badge>+10</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="mt-4 rounded-lg border p-4">
              <h4 className="font-semibold">Risk Levels</h4>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">0–24</div>
                  <div className="text-sm text-muted-foreground">LOW → CLEARED</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">25–49</div>
                  <div className="text-sm text-muted-foreground">MODERATE → CLEARED</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">50–74</div>
                  <div className="text-sm text-muted-foreground">HIGH → FLAGGED</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">75+</div>
                  <div className="text-sm text-muted-foreground">CRITICAL → FLAGGED</div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border p-4">
              <h4 className="font-semibold">Billing Policy Limits</h4>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <div><strong>Dispensary:</strong> KES 10K/encounter, KES 5K/service, KES 15K/day</div>
                <div><strong>Health Centre:</strong> KES 50K/encounter, KES 30K/service, KES 75K/day</div>
                <div><strong>Sub-County:</strong> KES 200K/encounter, KES 100K/service, KES 300K/day</div>
                <div><strong>County Referral:</strong> KES 500K/encounter, KES 200K/service, KES 600K/day</div>
                <div><strong>National Referral:</strong> KES 2M/encounter, KES 1M/service, KES 2.5M/day</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        SHA Compliance Platform — Demo Version
      </footer>
    </div>
  )
}
