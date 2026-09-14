import { Request, Response, NextFunction } from 'express';
export declare function getLeaveTypes(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function createLeaveType(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getLeaveBalances(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getLeaveRequests(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function submitLeaveRequest(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function processLeaveApproval(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
