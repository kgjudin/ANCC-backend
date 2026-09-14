import { Request, Response, NextFunction } from 'express';
export declare function getPurchaseSummaryReport(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getExpenseSummaryReport(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
