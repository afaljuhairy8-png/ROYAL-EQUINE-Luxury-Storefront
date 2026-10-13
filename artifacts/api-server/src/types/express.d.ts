export {};

declare global {
  namespace Express {
    interface Request {
      royalUser?: {
        id: string;
        name: string;
        email: string;
      };
    }
  }
}
