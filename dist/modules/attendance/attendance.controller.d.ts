import { Request, Response, NextFunction } from 'express';
export declare function getAttendance(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function recordAttendance(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
