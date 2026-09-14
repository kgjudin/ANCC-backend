import { Request, Response, NextFunction } from 'express';
export declare function getProductCategories(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getProducts(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function createProduct(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function updateProduct(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
