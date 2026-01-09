/**
 * Type definitions for the Drawings feature
 */

export interface Drawing {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  file_size: number | null;
  sheet_number: string | null;
  revision_number: string | null;
  revision_date: string | null;
  project_id: string;
  document_type: string | null;
  description: string | null;
  created_at: string;
  uploaded_by: string;
  projects?: {
    name: string;
  };
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

export interface DrawingUploadData {
  file: File;
  projectId: string;
  sheetNumber?: string;
  revisionNumber?: string;
  documentType?: string;
  description?: string;
}

export interface DrawingRevision {
  id: string;
  revision_number: string | null;
  revision_date: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
  };
}
