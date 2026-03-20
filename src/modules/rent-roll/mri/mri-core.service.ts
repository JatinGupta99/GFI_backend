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

    private get restBaseUrl(): string {
        return this.baseUrl.replace('api.asp', '').replace(/\/$/, '');
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
            const authHeader = `Basic ${encoded}`;

            // Enhanced debugging for authentication issues
            this.logger.debug(`🔐 MRI Auth Debug -> ClientId: ${clientId?.substring(0, 4)}***, DB: ${db}, User: ${user}, Key: ${key?.substring(0, 4)}***`);
            this.logger.debug(`🔐 Auth String Format: ${clientId?.substring(0, 4)}***/${db}/${user}/${key?.substring(0, 4)}***:${pass?.substring(0, 2)}***`);
            this.logger.debug(`🔐 Auth Header Length: ${authHeader.length} chars`);

            return authHeader;
        }
    /**
     * Compare authentication patterns between different API calls for debugging
     */
    private logAuthComparison(apiName: string, method: string): void {
        const authHeader = this.authHeader;
        this.logger.debug(`🔍 Auth Comparison -> API: ${apiName} | Method: ${method} | Auth: ${authHeader.substring(0, 20)}...`);

        // Log if this is the problematic API
        if (apiName === 'MRI_S-PMCM_CommercialLeasesNoteByBuildingID') {
            this.logger.warn(`⚠️  Problematic API detected: ${apiName} | Using same auth as working APIs`);
        }
    }


    /**
     * Generic GET wrapper for MRI RESTful path-based APIs
     */
    async getRest<T>(path: string, params: any = {}, retries = 3): Promise<T> {
        const startTime = Date.now();
        this.logger.log(`🔵 MRI REST API Call -> ${path} | Params: ${JSON.stringify(params)}`);

        let lastError: any;
        for (let i = 0; i < retries; i++) {
            try {
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                const url = `${this.restBaseUrl}/${cleanPath}`;
                const authHeader = this.authHeader;

                const { data } = await firstValueFrom(
                    this.httpService.get<T>(url, {
                        params,
                        headers: {
                            'Authorization': authHeader,
                            'Accept': 'application/json'
                        },
                        timeout: 15000
                    })
                );

                const duration = Date.now() - startTime;
                const recordCount = Array.isArray(data) ? data.length : 'N/A';
                
                // Log response data (first record only for brevity)
                if (Array.isArray(data) && data.length > 0) {
                    this.logger.log(`✅ MRI REST Success -> ${path} | Records: ${recordCount} | Duration: ${duration}ms | Sample: ${JSON.stringify(data[0])}`);
                } else {
                    this.logger.log(`✅ MRI REST Success -> ${path} | Records: ${recordCount} | Duration: ${duration}ms | Response: ${JSON.stringify(data)}`);
                }
                
                return data;

            } catch (error) {
                lastError = error;
                const duration = Date.now() - startTime;
                const errorBody = error.response?.data?.toString() || '';
                const isDeadlock = errorBody.includes('deadlocked');
                const is500 = error.response?.status === 500;
                const statusCode = error.response?.status || 'N/A';

                if ((is500 || isDeadlock) && i < retries - 1) {
                    const delay = (i + 1) * 1000;
                    this.logger.warn(`⚠️  MRI REST Retry -> ${path} | Status: ${statusCode} | Attempt: ${i + 1}/${retries} | Retrying in ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                this.logger.error(`❌ MRI REST Failed -> ${path} | Status: ${statusCode} | Params: ${JSON.stringify(params)} | Duration: ${duration}ms | Error: ${error.message}`);
                if (error.response) {
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

    /**
     * Generic GET wrapper for MRI endpoints with retry logic for deadlocks/500s (OData style)
     */
    async get<T>(apiName: string, params: any = {}, retries = 3): Promise<T> {
        const startTime = Date.now();
        const sanitizedParams = { ...params };
        delete sanitizedParams.$api;
        delete sanitizedParams.$format;
        
        this.logger.log(`🔵 MRI API Call -> ${apiName} | Params: ${JSON.stringify(sanitizedParams)}`);

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

                const result = (data && typeof data === 'object' && 'value' in data)
                    ? (data as any).value
                    : data;

                const duration = Date.now() - startTime;
                const recordCount = Array.isArray(result) ? result.length : 'N/A';
                
                // Log response data (first record only for brevity)
                if (Array.isArray(result) && result.length > 0) {
                    this.logger.log(`✅ MRI Success -> ${apiName} | Records: ${recordCount} | Duration: ${duration}ms | Sample: ${JSON.stringify(result[0])}`);
                } else {
                    this.logger.log(`✅ MRI Success -> ${apiName} | Records: ${recordCount} | Duration: ${duration}ms | Response: ${JSON.stringify(result)}`);
                }

                return result as T;

            } catch (error) {
                lastError = error;
                const duration = Date.now() - startTime;
                const errorBody = error.response?.data?.toString() || '';
                const isDeadlock = errorBody.includes('deadlocked');
                const is500 = error.response?.status === 500;
                const is429 = error.response?.status === 429; // Rate limit
                const statusCode = error.response?.status || 'N/A';

                // Retry on 500, deadlock, or 429 (rate limit)
                if ((is500 || isDeadlock || is429) && i < retries - 1) {
                    // Exponential backoff: 429 gets longer delays
                    const baseDelay = is429 ? 5000 : 1000; // 5s for rate limit, 1s for others
                    const delay = baseDelay * Math.pow(2, i); // Exponential: 5s, 10s, 20s for 429
                    
                    this.logger.warn(`⚠️  MRI Retry -> ${apiName} | Status: ${statusCode} | Attempt: ${i + 1}/${retries} | Retrying in ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                this.logger.error(`❌ MRI Failed -> ${apiName} | Status: ${statusCode} | Params: ${JSON.stringify(sanitizedParams)} | Duration: ${duration}ms | Error: ${error.message}`);
                if (error.response) {
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

    /**
     * Generic PUT wrapper for MRI endpoints (for create/update operations)
     */
    async put<T>(apiName: string, params: any = {}, body: any, retries = 3): Promise<T> {
        const startTime = Date.now();
        const sanitizedParams = { ...params };
        delete sanitizedParams.$api;
        delete sanitizedParams.$format;
        
        this.logger.log(`🔵 MRI PUT Call -> ${apiName} | Params: ${JSON.stringify(sanitizedParams)} | Body: ${JSON.stringify(body)}`);

        let lastError: any;
        for (let i = 0; i < retries; i++) {
            const queryParams = {
                '$api': apiName,
                '$format': 'json',
                ...params
            };
            
            try {
                const url = this.baseUrl;
                const authHeader = this.authHeader;

                // Enhanced logging for problematic API
                if (apiName === 'MRI_S-PMCM_CommercialLeasesNoteByBuildingID') {
                    this.logger.debug(`🔍 Commercial Lease Notes API Debug:`);
                    this.logger.debug(`   URL: ${url}`);
                    this.logger.debug(`   Auth Header: ${authHeader.substring(0, 20)}...`);
                    this.logger.debug(`   API Name: ${apiName}`);
                    this.logger.debug(`   Body Structure: ${JSON.stringify(body, null, 2)}`);
                }

                const { data } = await firstValueFrom(
                    this.httpService.put<T>(url, body, {
                        params: queryParams,
                        headers: {
                            'Authorization': authHeader,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        timeout: 15000
                    })
                );

                const result = (data && typeof data === 'object' && 'value' in data)
                    ? (data as any).value
                    : data;

                const duration = Date.now() - startTime;
                this.logger.log(`✅ MRI PUT Success -> ${apiName} | Duration: ${duration}ms | Response: ${JSON.stringify(result)}`);

                return result as T;

            } catch (error) {
                lastError = error;
                const duration = Date.now() - startTime;
                const errorBody = error.response?.data?.toString() || '';
                const isDeadlock = errorBody.includes('deadlocked');
                const is500 = error.response?.status === 500;
                const is401 = error.response?.status === 401;
                const statusCode = error.response?.status || 'N/A';

                // Enhanced 401 debugging for commercial lease notes API
                if (is401 && apiName === 'MRI_S-PMCM_CommercialLeasesNoteByBuildingID') {
                    this.logger.error(`🚨 401 Authentication Error Details:`);
                    this.logger.error(`   API: ${apiName}`);
                    this.logger.error(`   URL: ${this.baseUrl}`);
                    this.logger.error(`   Query Params: ${JSON.stringify(queryParams)}`);
                    this.logger.error(`   Request Headers: Authorization=${this.authHeader.substring(0, 20)}..., Content-Type=application/json`);
                    this.logger.error(`   Response Headers: ${JSON.stringify(error.response?.headers || {})}`);
                    this.logger.error(`   Response Body: ${errorBody}`);
                    this.logger.error(`   Compare with working API: MRI_S-PMCM_CurrentDelinquencies uses same auth pattern`);
                }

                if ((is500 || isDeadlock) && i < retries - 1) {
                    const delay = (i + 1) * 1000;
                    this.logger.warn(`⚠️  MRI PUT Retry -> ${apiName} | Status: ${statusCode} | Attempt: ${i + 1}/${retries} | Retrying in ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                this.logger.error(`❌ MRI PUT Failed -> ${apiName} | Status: ${statusCode} | Params: ${JSON.stringify(sanitizedParams)} | Duration: ${duration}ms | Error: ${error.message}`);
                if (error.response) {
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

    /**
     * Generic POST wrapper for MRI endpoints (for create operations)
     */
    async post<T>(apiName: string, params: any = {}, body: any, retries = 3): Promise<T> {
        const startTime = Date.now();
        const sanitizedParams = { ...params };
        delete sanitizedParams.$api;
        delete sanitizedParams.$format;
        
        this.logger.log(`🔵 MRI POST Call -> ${apiName} | Params: ${JSON.stringify(sanitizedParams)} | Body: ${JSON.stringify(body)}`);

        let lastError: any;
        for (let i = 0; i < retries; i++) {
            const queryParams = {
                '$api': apiName,
                '$format': 'json',
                ...params
            };
            
            try {
                const url = this.baseUrl;
                const authHeader = this.authHeader;

                // Enhanced logging for problematic API
                if (apiName === 'MRI_S-PMCM_CommercialLeasesNoteByBuildingID') {
                    this.logger.debug(`🔍 Commercial Lease Notes API Debug (POST):`);
                    this.logger.debug(`   URL: ${url}`);
                    this.logger.debug(`   Auth Header: ${authHeader.substring(0, 20)}...`);
                    this.logger.debug(`   API Name: ${apiName}`);
                    this.logger.debug(`   Body Structure: ${JSON.stringify(body, null, 2)}`);
                }

                const { data } = await firstValueFrom(
                    this.httpService.post<T>(url, body, {
                        params: queryParams,
                        headers: {
                            'Authorization': authHeader,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        timeout: 15000
                    })
                );

                const result = (data && typeof data === 'object' && 'value' in data)
                    ? (data as any).value
                    : data;

                const duration = Date.now() - startTime;
                this.logger.log(`✅ MRI POST Success -> ${apiName} | Duration: ${duration}ms | Response: ${JSON.stringify(result)}`);

                return result as T;

            } catch (error) {
                lastError = error;
                const duration = Date.now() - startTime;
                const errorBody = error.response?.data?.toString() || '';
                const isDeadlock = errorBody.includes('deadlocked');
                const is500 = error.response?.status === 500;
                const is401 = error.response?.status === 401;
                const statusCode = error.response?.status || 'N/A';

                // Enhanced 401 debugging for commercial lease notes API
                if (is401 && apiName === 'MRI_S-PMCM_CommercialLeasesNoteByBuildingID') {
                    this.logger.error(`🚨 401 Authentication Error Details (POST):`);
                    this.logger.error(`   API: ${apiName}`);
                    this.logger.error(`   URL: ${this.baseUrl}`);
                    this.logger.error(`   Query Params: ${JSON.stringify(queryParams)}`);
                    this.logger.error(`   Request Headers: Authorization=${this.authHeader.substring(0, 20)}..., Content-Type=application/json`);
                    this.logger.error(`   Response Headers: ${JSON.stringify(error.response?.headers || {})}`);
                    this.logger.error(`   Response Body: ${errorBody}`);
                    this.logger.error(`   Compare with working API: MRI_S-PMCM_CurrentDelinquencies uses same auth pattern`);
                }

                if ((is500 || isDeadlock) && i < retries - 1) {
                    const delay = (i + 1) * 1000;
                    this.logger.warn(`⚠️  MRI POST Retry -> ${apiName} | Status: ${statusCode} | Attempt: ${i + 1}/${retries} | Retrying in ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                this.logger.error(`❌ MRI POST Failed -> ${apiName} | Status: ${statusCode} | Params: ${JSON.stringify(sanitizedParams)} | Duration: ${duration}ms | Error: ${error.message}`);
                if (error.response) {
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