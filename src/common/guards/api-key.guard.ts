import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.header('x-api-key');
    const expected = this.config.get<string>('app.apiKey');

    if (!apiKey || apiKey !== expected) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
