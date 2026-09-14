import { Request, Response, NextFunction } from 'express';
import { Employee } from '@construction/shared-types';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        company_id: string;
    };
    employee?: Employee;
    permissions?: string[];
}
export declare function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
