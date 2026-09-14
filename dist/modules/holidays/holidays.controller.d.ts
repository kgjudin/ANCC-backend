import { Request, Response, NextFunction } from 'express';
export declare function getHolidays(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function createHoliday(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function deleteHoliday(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
