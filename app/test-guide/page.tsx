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
  status: "VERIFIED" | "UNVERIFIED" | "SUSPENDED"
  services: string[]
  testCases: TestCase[]
}

const AMOUNT_THRESHOLD_KES = 750_000
const QTY_THRESHOLD = 10

const hospitals: HospitalTestGroup[] = [
  {
    id: "kibera",
    name: "Kibera Community Dispensary",
    tier: "Level 2 - Dispensary",
    county: "Nairobi",
    email: "faith@kiberadispensary.co.ke",
    status: "UNVERIFIED",
    services: ["CONSULTATION", "PHARMACY", "IMMUNIZATION", "FAMILY_PLANNING"],
    testCases: [
      {
        name: "Unverified small facility",
        diagnosis: "Common cold",
        items: [{ service: "CONSULTATION", qty: 1, amountKes: 150 }],
        expected: "R-001 triggers - FLAGGED",
        severity: "danger",
        note: "Dispensary is UNVERIFIED - any claim triggers R-001",
      },
    ],
  },
  {
    id: "ongata",
    name: "Ongata Rongai Health Centre",
    tier: "Level 3 - Health Centre",
    county: "Kajiado",
    email: "josephine@ongatahealth.co.ke",
    status: "VERIFIED",
    services: [
      "CONSULTATION",
      "MALARIA_TEST",
      "CBC",
      "URINALYSIS",
      "PHARMACY",
      "IMMUNIZATION",
      "FAMILY_PLANNING",
      "ANC",
      "DELIVERY_NORMAL",
    ],
    testCases: [
      {
        name: "Clean maternity claim",
        diagnosis: "Normal delivery",
        items: [{ service: "DELIVERY_NORMAL", qty: 1, amountKes: 30000 }],
        expected: "CLEARED - no rules trigger",
        severity: "none",
      },
      {
        name: "Service mismatch",
        diagnosis: "Suspected fracture",
        items: [{ service: "X_RAY", qty: 1, amountKes: 1500 }],
        expected: "R-002 triggers - FLAGGED",
        severity: "danger",
        note: "Health centre has no radiology service",
      },
    ],
  },
  {
    id: "kiambu",
    name: "Kiambu Sub-County Hospital",
    tier: "Level 4 - Sub-County Hospital",
    county: "Kiambu",
    email: "daniel@kiambuscsh.go.ke",
    status: "VERIFIED",
    services: [
      "CONSULTATION",
      "SPECIALIST_CONSULT",
      "MALARIA_TEST",
      "CBC",
      "URINALYSIS",
      "BLOOD_CHEM",
      "X_RAY",
      "ULTRASOUND",
      "ANC",
      "DELIVERY_NORMAL",
      "DELIVERY_CS",
      "POSTNATAL",
      "SURGERY_MINOR",
      "PHARMACY",
      "EMERGENCY",
      "DENTAL",
    ],
    testCases: [
      {
        name: "Unusual quantity",
        diagnosis: "Repeat lab work-up",
        items: [{ service: "CBC", qty: 12, amountKes: 500 }],
        expected: "R-005 triggers (qty > 10) - CLEARED (score 10)",
        severity: "warning",
        note: "Single rule score below flag threshold",
      },
      {
        name: "Service mismatch",
        diagnosis: "Head injury",
        items: [{ service: "CT_SCAN", qty: 1, amountKes: 8000 }],
        expected: "R-002 triggers - FLAGGED",
        severity: "danger",
        note: "No CT scanner at this facility tier",
      },
    ],
  },
  {
    id: "nakuru",
    name: "Nakuru County Referral Hospital",
    tier: "Level 5 - County Referral Hospital",
    county: "Nakuru",
    email: "esther@nakurureferral.go.ke",
    status: "VERIFIED",
    services: [
      "CONSULTATION",
      "SPECIALIST_CONSULT",
      "MALARIA_TEST",
      "CBC",
      "URINALYSIS",
      "BLOOD_CHEM",
      "HIV_TEST",
      "TB_SCREEN",
      "BLOOD_GROUP",
      "X_RAY",
      "ULTRASOUND",
      "CT_SCAN",
      "SURGERY_MAJOR",
      "ORTHO_SURGERY",
      "ANC",
      "DELIVERY_NORMAL",
      "DELIVERY_CS",
      "POSTNATAL",
      "DENTAL",
      "PHARMACY",
      "EMERGENCY",
      "AMBULANCE",
      "ICU",
      "PHYSIOTHERAPY",
      "MENTAL_HEALTH",
    ],
    testCases: [
      {
        name: "High amount + quantity",
        diagnosis: "Complex orthopedic surgery",
        items: [
          { service: "ORTHO_SURGERY", qty: 1, amountKes: 450000 },
          { service: "ICU", qty: 12, amountKes: 15000 },
          { service: "SURGERY_MAJOR", qty: 1, amountKes: 200000 },
        ],
        expected: "R-004 + R-005 trigger - CLEARED (score 25)",
        severity: "warning",
        note: "Total exceeds KES 750,000 but combined score below flag threshold",
      },
    ],
  },
  {
    id: "eldoret",
    name: "Eldoret National Referral Hospital",
    tier: "Level 6 - National Referral Hospital",
    county: "Uasin Gishu",
    email: "kiplangat@eldoretnrh.go.ke",
    status: "VERIFIED",
    services: ["ALL SERVICES"],
    testCases: [
      {
        name: "Critical amount claim",
        diagnosis: "Multi-organ trauma",
        items: [
          { service: "SURGERY_MAJOR", qty: 2, amountKes: 400000 },
          { service: "ICU", qty: 20, amountKes: 15000 },
        ],
        expected: "R-004 + R-005 trigger - CLEARED (score 25)",
        severity: "warning",
        note: "Total exceeds KES 1,000,000 but combined score below flag threshold",
      },
    ],
  },
  {
    id: "nairobi",
    name: "Nairobi General Hospital",
    tier: "Private General Hospital",
    county: "Nairobi",
    email: "james@nairobigen.co.ke",
    status: "VERIFIED",
    services: [
      "CONSULTATION",
      "SPECIALIST_CONSULT",
      "MALARIA_TEST",
      "CBC",
      "URINALYSIS",
      "BLOOD_CHEM",
      "X_RAY",
      "ULTRASOUND",
      "SURGERY_MINOR",
      "SURGERY_MAJOR",
      "ANC",
      "DELIVERY_NORMAL",
      "DELIVERY_CS",
      "POSTNATAL",
      "DENTAL",
      "PHARMACY",
      "EMERGENCY",
      "ICU",
    ],
    testCases: [
      {
        name: "Clean claim",
        diagnosis: "Common cold",
        items: [{ service: "CONSULTATION", qty: 1, amountKes: 1500 }],
        expected: "CLEARED - no rules trigger",
        severity: "none",
      },
      {
        name: "Service mismatch",
        diagnosis: "Chronic kidney disease",
        items: [{ service: "DIALYSIS", qty: 3, amountKes: 8000 }],
        expected: "R-002 triggers - FLAGGED",
        severity: "danger",
        note: "No dialysis unit at this facility",
      },
    ],
  },
  {
    id: "coast",
    name: "Coast Medical Centre",
    tier: "Private Medical Centre",
    county: "Mombasa",
    email: "amina@coastmedical.co.ke",
    status: "VERIFIED",
    services: ["CONSULTATION", "MALARIA_TEST", "X_RAY", "PHARMACY"],
    testCases: [
      {
        name: "Service mismatch",
        diagnosis: "Fracture - needs MRI",
        items: [{ service: "MRI", qty: 1, amountKes: 15000 }],
        expected: "R-002 triggers - FLAGGED",
        severity: "danger",
        note: "Coast is NOT authorized for MRI",
      },
      {
        name: "Unusual quantity",
        diagnosis: "Severe malaria",
        items: [{ service: "PHARMACY", qty: 12, amountKes: 400 }],
        expected: "R-005 triggers (qty > 10) - CLEARED (score 10)",
        severity: "warning",
        note: "Single rule score below flag threshold",
      },
    ],
  },
  {
    id: "riftvalley",
    name: "Rift Valley Clinic",
    tier: "Small Private Clinic",
    county: "Nakuru",
    email: "peter@riftvalley.co.ke",
    status: "UNVERIFIED",
    services: ["CONSULTATION", "PHARMACY"],
    testCases: [
      {
        name: "Basic unverified",
        diagnosis: "Headache",
        items: [{ service: "CONSULTATION", qty: 1, amountKes: 1000 }],
        expected: "R-001 triggers - FLAGGED (score 50)",
        severity: "danger",
        note: "Single R-001 triggers flag threshold",
      },
      {
        name: "Mismatch + unverified",
        diagnosis: "Back pain - MRI needed",
        items: [{ service: "MRI", qty: 1, amountKes: 15000 }],
        expected: "R-001 + R-002 trigger - FLAGGED (score 100)",
        severity: "danger",
        note: "MRI not authorized AND facility unverified - critical risk",
      },
    ],
  },
  {
    id: "western",
    name: "Western Province Hospital",
    tier: "Private General Hospital",
    county: "Kisumu",
    email: "grace@westernprov.co.ke",
    status: "VERIFIED",
    services: [
      "CONSULTATION",
      "CBC",
      "X_RAY",
      "ULTRASOUND",
      "PHARMACY",
      "EMERGENCY",
    ],
    testCases: [
      {
        name: "Clean claim",
        diagnosis: "Prenatal checkup",
        items: [{ service: "ULTRASOUND", qty: 1, amountKes: 2000 }],
        expected: "CLEARED - all services authorized",
        severity: "none",
      },
      {
        name: "Mismatch + high amount",
        diagnosis: "Appendicitis",
        items: [{ service: "SURGERY_MAJOR", qty: 1, amountKes: 900000 }],
        expected: "R-002 + R-004 trigger - FLAGGED",
        severity: "danger",
        note: "Surgery not authorized AND total exceeds KES 750,000",
      },
    ],
  },
  {
    id: "highland",
    name: "Highland Specialized Hospital",
    tier: "Private Specialist Hospital (Suspended)",
    county: "Nyeri",
    email: "david@highland.co.ke",
    status: "SUSPENDED",
    services: [],
    testCases: [
      {
        name: "Any claim",
        diagnosis: "Any condition",
        items: [{ service: "CONSULTATION", qty: 1, amountKes: 950 }],
        expected: "R-001 + R-002 trigger - always FLAGGED",
        severity: "danger",
        note: "Suspended, rejected verification, zero authorized services",
      },
    ],
  },
  {
    id: "savannah",
    name: "Savannah Specialist & Cancer Centre",
    tier: "Private Specialist Hospital",
    county: "Nairobi",
    email: "nasra@savannahcancer.co.ke",
    status: "VERIFIED",
    services: [
      "SPECIALIST_CONSULT",
      "CBC",
      "BLOOD_CHEM",
      "CT_SCAN",
      "MRI",
      "CHEMOTHERAPY",
      "DIALYSIS",
      "ICU",
      "PHARMACY",
    ],
    testCases: [
      {
        name: "Service mismatch",
        diagnosis: "Referral for delivery",
        items: [{ service: "DELIVERY_NORMAL", qty: 1, amountKes: 30000 }],
        expected: "R-002 triggers - FLAGGED",
        severity: "danger",
        note: "Cancer centre does not offer maternity services",
      },
    ],
  },
  {
    id: "tumaini",
    name: "Tumaini Maternity Home",
    tier: "Small Private Maternity Home",
    county: "Nairobi",
    email: "mercy@tumainimaternity.co.ke",
    status: "VERIFIED",
    services: [
      "CONSULTATION",
      "ANC",
      "DELIVERY_NORMAL",
      "POSTNATAL",
      "ULTRASOUND",
      "PHARMACY",
    ],
    testCases: [
      {
        name: "Service mismatch",
        diagnosis: "Delivery complications",
        items: [{ service: "SURGERY_MAJOR", qty: 1, amountKes: 150000 }],
        expected: "R-002 triggers - FLAGGED",
        severity: "danger",
        note: "Maternity home cannot perform major surgery",
      },
    ],
  },
]

const demoAccounts = hospitals.map((h) => ({
  email: h.email,
  hospital: h.name,
  role: "Hospital User",
}))
demoAccounts.push(
  { email: "sarah@sha.go.ke", hospital: "SHA Officer", role: "SHA Officer" },
  { email: "michael@sha.go.ke", hospital: "SHA Officer", role: "SHA Officer" },
  { email: "admin@sha.go.ke", hospital: "Admin", role: "Admin" }
)

const password = "password"

export default function TestGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="container py-8">
          <h1 className="text-3xl font-bold">SHA Compliance - Test Guide</h1>
          <p className="mt-2 text-primary-foreground/80">
            Step-by-step test scenarios across {hospitals.length} facilities,
            from dispensary to national referral hospital
          </p>
        </div>
      </header>

      <main className="container space-y-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              How Detection Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">1. Hospital Creates Invoice</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hospital user creates a draft claim and adds line items. No
                  validation at this stage.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">2. SHA Processes</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Officer clicks &quot;Process&quot; → rules run → AI analyzes →
                  risk score is calculated
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">3. Detection Happens</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  If score ≥ 50 → FLAGGED → alert generated for investigation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                  <code className="mt-1 block text-xs text-muted-foreground">
                    {account.email}
                  </code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {hospitals.map((hospital) => {
            const StatusIcon =
              hospital.status === "VERIFIED"
                ? CheckCircle2
                : hospital.status === "SUSPENDED"
                  ? XCircle
                  : AlertTriangle
            const statusColor =
              hospital.status === "VERIFIED"
                ? "text-green-600"
                : hospital.status === "SUSPENDED"
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
                  <TableCell>
                    <Badge>R-001</Badge>
                  </TableCell>
                  <TableCell>Facility Not Verified</TableCell>
                  <TableCell>verificationStatus ≠ VERIFIED</TableCell>
                  <TableCell>
                    <Badge variant="destructive">+50</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Badge>R-002</Badge>
                  </TableCell>
                  <TableCell>Service Mismatch</TableCell>
                  <TableCell>
                    Service not in hospital&apos;s authorized list
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">+50</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Badge>R-003</Badge>
                  </TableCell>
                  <TableCell>Duplicate Claim</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      Not implemented
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge>+30</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Badge>R-004</Badge>
                  </TableCell>
                  <TableCell>Unusual Amount</TableCell>
                  <TableCell>
                    Total &gt; KES {AMOUNT_THRESHOLD_KES.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">+15</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Badge>R-005</Badge>
                  </TableCell>
                  <TableCell>Unusual Quantity</TableCell>
                  <TableCell>Any item qty &gt; {QTY_THRESHOLD}</TableCell>
                  <TableCell>
                    <Badge variant="default">+10</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Badge>R-006</Badge>
                  </TableCell>
                  <TableCell>Diagnosis Mismatch</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      Not implemented
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge>+20</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="mt-4 rounded-lg border p-4">
              <h4 className="font-semibold">Risk Levels</h4>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">0-24</div>
                  <div className="text-sm text-muted-foreground">
                    LOW → CLEARED
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    25-49
                  </div>
                  <div className="text-sm text-muted-foreground">
                    MODERATE → CLEARED
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    50-74
                  </div>
                  <div className="text-sm text-muted-foreground">
                    HIGH → FLAGGED
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">75+</div>
                  <div className="text-sm text-muted-foreground">
                    CRITICAL → FLAGGED
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        SHA Compliance Platform - Demo Version
      </footer>
    </div>
  )
}
