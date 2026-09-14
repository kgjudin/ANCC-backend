import { Request, Response, NextFunction } from 'express';
export declare function getExpenses(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function createExpense(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
