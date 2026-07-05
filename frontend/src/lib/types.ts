export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: string[];
  steps: string[];
  imageUrl: string | null;
  authorId: string;
  author?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface RecipeInput {
  title: string;
  description: string;
  ingredients: string[];
  steps: string[];
  imageUrl?: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}
