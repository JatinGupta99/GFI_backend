import { Injectable, HttpException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MriCoreService {
    private readonly logger = new Logger(MriCoreService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) { }

    private get baseUrl(): string {
        const url = this.configService.get<string>('mri.apiUrl');
        if (!url) {
            this.logger.error('MRI baseUrl missing from configuration');
            throw new Error('MRI baseUrl not configured');
        }
        return url;
    }

    private get authHeader(): string {
        const clientId = this.configService.get<string>('mri.clientId');
        const db = this.configService.get<string>('mri.databaseName');
        const user = this.configService.get<string>('mri.userId');
        const key = this.configService.get<string>('mri.developerKey');
        const pass = this.configService.get<string>('mri.password');

        if (!clientId || !db || !user || !key || !pass) {
            this.logger.error('MRI credentials missing from configuration');
            throw new Error('MRI credentials not configured');
        }

        const authString = `${clientId}/${db}/${user}/${key}:${pass}`;
        const encoded = Buffer.from(authString).toString('base64');
        return `Basic ${encoded}`;
    }

    /**
     * Generic GET wrapper for MRI endpoints with retry logic for deadlocks/500s
     */
    async get<T>(apiName: string, params: any = {}, retries = 3): Promise<T> {
        this.logger.log(`MRI GET -> ${apiName}`);

        let lastError: any;
        for (let i = 0; i < retries; i++) {
            try {
                const url = this.baseUrl;
                const authHeader = this.authHeader;

                const queryParams = {
                    '$api': apiName,
                    '$format': 'json',
                    ...params
                };

                const { data } = await firstValueFrom(
                    this.httpService.get<T>(url, {
                        params: queryParams,
                        headers: {
                            'Authorization': authHeader,
                            'Accept': 'application/json, application/xml'
                        },
                        timeout: 15000
                    })
                );

                // MRI OData-style responses wrap arrays in a 'value' property
                const result = (data && typeof data === 'object' && 'value' in data)
                    ? (data as any).value
                    : data;

                return result as T;

            } catch (error) {
                lastError = error;
                const errorBody = error.response?.data?.toString() || '';
                const isDeadlock = errorBody.includes('deadlocked');
                const is500 = error.response?.status === 500;

                if ((is500 || isDeadlock) && i < retries - 1) {
                    const delay = (i + 1) * 1000;
                    this.logger.warn(`MRI API Deadlock/500 detected for [${apiName}]. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                this.logger.error(`MRI API Error [${apiName}]: ${error.message}`);
                if (error.response) {
                    this.logger.error(`MRI Status=${error.response.status} Body=${JSON.stringify(error.response.data).substring(0, 500)}`);
                    throw new HttpException(
                        `MRI API Failed: ${error.response.statusText}`,
                        error.response.status
                    );
                }
                throw new HttpException('MRI API Unreachable', 503);
            }
        }
        throw lastError;
    }
}
