export interface CreateProjectInput {
  ownerId: string;
  createdById: string;
  name: string;
  description?: string | null;
}
