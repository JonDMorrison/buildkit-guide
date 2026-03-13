export type ProposalStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived';

export interface Proposal {
  id: string;
  organization_id: string;
  project_id: string;
  estimate_id: string | null;
  status: ProposalStatus;
  title: string;
  customer_po_or_contract_number: string | null;
  summary: string;
  assumptions: string;
  exclusions: string;
  timeline_text: string;
  created_by: string;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  project?: { name: string; job_number: string | null } | null;
  estimate?: { estimate_number: string } | null;
}

export interface ProposalSection {
  id: string;
  proposal_id: string;
  section_type: string;
  content: string;
  sort_order: number;
}

export interface ProposalEvent {
  id: string;
  proposal_id: string;
  actor_user_id: string;
  event_type: string;
  message: string | null;
  created_at: string;
  actor?: { full_name: string | null } | null;
}
