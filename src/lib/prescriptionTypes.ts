export const prescriptionFields = [
  "name",
  "strength",
  "dose",
  "route",
  "frequency",
  "duration",
  "instructions",
] as const;
export type PrescriptionFieldKey = (typeof prescriptionFields)[number];
export type PrescriptionField = {
  value: string | null;
  sourceText: string | null;
  status: "readable" | "unclear" | "not_present";
};
export type PrescriptionMedicine = {
  lineNumber: number;
  fields: Record<PrescriptionFieldKey, PrescriptionField>;
};
export type PrescriptionIssue =
  | "blurred"
  | "cropped"
  | "handwriting"
  | "not_prescription"
  | "other_document"
  | "model_disagreement"
  | "unreadable";
export type PrescriptionReading = {
  documentType:
    | "prescription"
    | "other_medical_document"
    | "not_prescription"
    | "unreadable";
  imageQuality: "clear" | "limited" | "unreadable";
  medicines: PrescriptionMedicine[];
  issues: PrescriptionIssue[];
};
export type PrescriptionReport = PrescriptionReading & {
  id: string;
  villageId: string | null;
  createdAt: number;
  verification: "two_reads_compared";
  requiresProfessionalReview: true;
};
