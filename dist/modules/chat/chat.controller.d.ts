import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
export declare function getChatContacts(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getChatRooms(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function createOrGetDirectRoom(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getRoomMessages(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function sendMessage(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
