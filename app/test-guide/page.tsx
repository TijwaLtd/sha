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

const hospitals = [
  {
    id: "nairobi",
    name: "Nairobi General Hospital",
    email: "james@nairobigen.co.ke",
    status: "VERIFIED",
    statusColor: "text-green-600",
    icon: CheckCircle2,
    services: ["CONSULTATION", "MALARIA_TEST", "CBC", "X_RAY", "SURGERY", "MATERNITY", "PHARMACY", "EMERGENCY"],
    testCases: [
      {
        name: "Clean Claim",
        diagnosis: "Common cold",
        items: [{ service: "CONSULTATION", qty: 1, amount: 1500 }],
        expected: "CLEARED - No rules trigger",
        severity: "none",
      },
      {
        name: "High Amount",
        diagnosis: "Complex surgery",
        items: [{ service: "SURGERY", qty: 1, amount: 800000 }],
        expected: "R-004 triggers (>KES 750k)",
        severity: "warning",
      },
    ],
  },
  {
    id: "coast",
    name: "Coast Medical Centre",
    email: "amina@coastmedical.co.ke",
    status: "VERIFIED",
    statusColor: "text-green-600",
    icon: CheckCircle2,
    services: ["CONSULTATION", "MALARIA_TEST", "X_RAY", "PHARMACY"],
    testCases: [
      {
        name: "Service Mismatch",
        diagnosis: "Fracture - needs MRI",
        items: [{ service: "MRI", qty: 1, amount: 15000 }],
        expected: "R-002 triggers - MRI not authorized",
        severity: "danger",
        note: "Coast is NOT authorized for MRI",
      },
      {
        name: "Unusual Quantity",
        diagnosis: "Malaria with complications",
        items: [{ service: "MALARIA_TEST", qty: 15, amount: 500 }],
        expected: "R-005 triggers (qty > 10)",
        severity: "warning",
      },
      {
        name: "High Amount + Quantity",
        diagnosis: "Severe malaria",
        items: [
          { service: "CONSULTATION", qty: 3, amount: 200000 },
          { service: "MALARIA_TEST", qty: 5, amount: 50000 },
          { service: "PHARMACY", qty: 10, amount: 40000 },
        ],
        expected: "R-004 + R-005 trigger - FLAGGED",
        severity: "danger",
      },
    ],
  },
  {
    id: "riftvalley",
    name: "Rift Valley Clinic",
    email: "peter@riftvalley.co.ke",
    status: "UNVERIFIED",
    statusColor: "text-orange-600",
    icon: AlertTriangle,
    services: ["CONSULTATION", "PHARMACY"],
    testCases: [
      {
        name: "Basic Unverified",
        diagnosis: "Headache",
        items: [{ service: "CONSULTATION", qty: 1, amount: 1000 }],
        expected: "R-001 triggers - FLAGGED",
        severity: "danger",
        note: "Rift Valley is UNVERIFIED",
      },
      {
        name: "Service Mismatch + Unverified",
        diagnosis: "Back pain - MRI needed",
        items: [{ service: "MRI", qty: 1, amount: 15000 }],
        expected: "R-001 + R-002 + R-004 - CRITICAL",
        severity: "danger",
        note: "MRI not authorized AND unverified",
      },
      {
        name: "Multiple Violations",
        diagnosis: "Complex condition",
        items: [
          { service: "X_RAY", qty: 5, amount: 100000 },
          { service: "CBC", qty: 3, amount: 50000 },
        ],
        expected: "R-001 + R-004 - FLAGGED",
        severity: "danger",
        note: "X_RAY and CBC not authorized for Rift Valley",
      },
    ],
  },
  {
    id: "western",
    name: "Western Province Hospital",
    email: "grace@westernprov.co.ke",
    status: "VERIFIED",
    statusColor: "text-green-600",
    icon: CheckCircle2,
    services: ["CONSULTATION", "CBC", "X_RAY", "ULTRASOUND", "PHARMACY", "EMERGENCY"],
    testCases: [
      {
        name: "Clean Claim",
        diagnosis: "Prenatal checkup",
        items: [
          { service: "CONSULTATION", qty: 1, amount: 100000 },
          { service: "ULTRASOUND", qty: 1, amount: 200000 },
        ],
        expected: "CLEARED - All services authorized",
        severity: "none",
      },
      {
        name: "High Amount Surgery",
        diagnosis: "Appendicitis",
        items: [
          { service: "SURGERY", qty: 1, amount: 3500000 },
          { service: "CONSULTATION", qty: 1, amount: 200000 },
          { service: "PHARMACY", qty: 1, amount: 500000 },
        ],
        expected: "R-004 triggers (KES 4.2M total) - FLAGGED",
        severity: "danger",
        note: "SURGERY not in Western's authorized services",
      },
    ],
  },
  {
    id: "highland",
    name: "Highland Specialized Hospital",
    email: "david@highland.co.ke",
    status: "SUSPENDED",
    statusColor: "text-red-600",
    icon: XCircle,
    services: [],
    testCases: [
      {
        name: "Suspended Hospital",
        diagnosis: "General checkup",
        items: [{ service: "CONSULTATION", qty: 1, amount: 1000 }],
        expected: "R-001 + SUSPENDED status - FLAGGED",
        severity: "danger",
        note: "Highland is SUSPENDED and has NO authorized services",
      },
      {
        name: "Any Claim",
        diagnosis: "Any condition",
        items: [{ service: "ANY", qty: 1, amount: 1000 }],
        expected: "Always FLAGGED - hospital suspended",
        severity: "danger",
      },
    ],
  },
]

const demoAccounts = [
  { email: "james@nairobigen.co.ke", hospital: "Nairobi General", role: "Hospital User" },
  { email: "amina@coastmedical.co.ke", hospital: "Coast Medical", role: "Hospital User" },
  { email: "peter@riftvalley.co.ke", hospital: "Rift Valley Clinic", role: "Hospital User" },
  { email: "grace@westernprov.co.ke", hospital: "Western Province", role: "Hospital User" },
  { email: "david@highland.co.ke", hospital: "Highland Specialized", role: "Hospital User" },
  { email: "sarah@sha.go.ke", hospital: "SHA Officer", role: "SHA Officer" },
  { email: "admin@sha.go.ke", hospital: "Admin", role: "Admin" },
]

const password = "password"

export default function TestGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="container py-8">
          <h1 className="text-3xl font-bold">SHA Compliance - Test Guide</h1>
          <p className="mt-2 text-primary-foreground/80">
            Step-by-step test scenarios for the SHA Claims Compliance Platform
          </p>
        </div>
      </header>

      <main className="container py-8 space-y-8">
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
                  Hospital user creates draft claim and adds line items. No validation at this stage.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">2. SHA Processes</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Officer clicks &quot;Process&quot; → Rules run → AI analyzes → Risk calculated
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">3. Detection Happens</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  If score ≥50 → FLAGGED → Alert generated for investigation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demo Accounts</CardTitle>
            <CardDescription>
              All accounts use password: <code className="bg-muted px-1 rounded">{password}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {demoAccounts.map((account) => (
                <div key={account.email} className="rounded-lg border p-3">
                  <div className="font-medium">{account.hospital}</div>
                  <div className="text-sm text-muted-foreground">{account.role}</div>
                  <code className="mt-1 block text-xs text-muted-foreground">
                    {account.email}
                  </code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {hospitals.map((hospital) => (
            <Card key={hospital.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <hospital.icon className={`h-6 w-6 ${hospital.statusColor}`} />
                    <div>
                      <CardTitle>{hospital.name}</CardTitle>
                      <CardDescription>
                        <code className="text-xs">{hospital.email}</code>
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={hospital.status === "VERIFIED" ? "default" : "destructive"}
                  >
                    {hospital.status}
                  </Badge>
                </div>
                <div className="mt-3">
                  <div className="text-sm font-medium">Authorized Services:</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {hospital.services.length > 0 ? (
                      hospital.services.map((s) => (
                        <Badge key={s} variant="outline">
                          {s}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">None (suspended)</span>
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
                            <div className="mt-1 text-xs text-orange-600">{tc.note}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {tc.items.map((item, i) => (
                            <div key={i} className="text-sm">
                              {item.service} × {item.qty} @ KES {item.amount.toLocaleString()}
                            </div>
                          ))}
                          <div className="mt-1 text-sm font-medium">
                            Total: KES{" "}
                            {tc.items
                              .reduce((sum, item) => sum + item.qty * item.amount, 0)
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
          ))}
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
                  <TableCell><Badge>R-001</Badge></TableCell>
                  <TableCell>Facility Not Verified</TableCell>
                  <TableCell>verificationStatus ≠ VERIFIED</TableCell>
                  <TableCell><Badge variant="destructive">+25</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge>R-002</Badge></TableCell>
                  <TableCell>Service Mismatch</TableCell>
                  <TableCell>Service not in hospital&apos;s authorized list</TableCell>
                  <TableCell><Badge variant="destructive">+20</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge>R-003</Badge></TableCell>
                  <TableCell>Duplicate Claim</TableCell>
                  <TableCell><span className="text-muted-foreground">Not implemented</span></TableCell>
                  <TableCell><Badge>+30</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge>R-004</Badge></TableCell>
                  <TableCell>Unusual Amount</TableCell>
                  <TableCell>Total &gt; KES 750,000</TableCell>
                  <TableCell><Badge variant="default">+15</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge>R-005</Badge></TableCell>
                  <TableCell>Unusual Quantity</TableCell>
                  <TableCell>Any item qty &gt; 10</TableCell>
                  <TableCell><Badge variant="default">+10</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Badge>R-006</Badge></TableCell>
                  <TableCell>Diagnosis Mismatch</TableCell>
                  <TableCell><span className="text-muted-foreground">Not implemented</span></TableCell>
                  <TableCell><Badge>+20</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="mt-4 rounded-lg border p-4">
              <h4 className="font-semibold">Risk Levels</h4>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">0-24</div>
                  <div className="text-sm text-muted-foreground">LOW → CLEARED</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">25-49</div>
                  <div className="text-sm text-muted-foreground">MODERATE → CLEARED</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">50-74</div>
                  <div className="text-sm text-muted-foreground">HIGH → FLAGGED</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">75+</div>
                  <div className="text-sm text-muted-foreground">CRITICAL → FLAGGED</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Test Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { hospital: "Nairobi", test: "Clean claim - should CLEAR", check: false },
                { hospital: "Coast", test: "MRI service - should FLAGGED (R-002)", check: false },
                { hospital: "Coast", test: "High quantity malaria tests - should FLAGGED", check: false },
                { hospital: "Rift Valley", test: "Any claim - should FLAGGED (R-001)", check: false },
                { hospital: "Rift Valley", test: "MRI + unverified - should CRITICAL", check: false },
                { hospital: "Western", test: "Surgery KES 4.2M - should FLAGGED", check: false },
                { hospital: "Highland", test: "Any claim - should always FLAGGED", check: false },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="h-5 w-5 rounded border-2 border-muted-foreground/30" />
                  <div>
                    <span className="font-medium">{item.hospital}:</span> {item.test}
                  </div>
                </div>
              ))}
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
