import crypto from 'crypto';

/**
 * SUMSUB PROVIDER (Strict Regulatory Attestation)
 * 
 * Handles interaction with Sumsub API for identity verification.
 * Implements secure token generation and webhook signature validation.
 */

const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN!;
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY!;
const SUMSUB_BASE_URL = 'https://api.sumsub.com'; // Use https://api.sumsub.com for production

export const sumsubProvider = {
    /**
     * Generate an access token for the WebSDK
     * @param userId Internal user ID to bind verification to
     * @param levelName The verification level (e.g., 'basic-kyc-level')
     */
    async generateAccessToken(userId: string, levelName: string = 'basic-kyc-level') {
        const path = `/resources/accessTokens?userId=${userId}&levelName=${levelName}&ttlInSecs=3600`;
        const method = 'POST';
        
        const config = this.createRequestConfig(method, path);
        
        try {
            const response = await fetch(SUMSUB_BASE_URL + path, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(`Sumsub API Error: ${JSON.stringify(data)}`);
            }
            
            return data.token;
        } catch (error) {
            console.error('[Sumsub] Failed to generate access token:', error);
            throw error;
        }
    },

    /**
     * Create a signed request configuration for Sumsub
     */
    createRequestConfig(method: string, path: string, body?: any) {
        const ts = Math.floor(Date.now() / 1000);
        const signature = crypto
            .createHmac('sha256', SUMSUB_SECRET_KEY)
            .update(ts + method + path + (body ? JSON.stringify(body) : ''))
            .digest('hex');

        return {
            method,
            headers: {
                'X-App-Token': SUMSUB_APP_TOKEN,
                'X-App-Access-Sig': signature,
                'X-App-Access-Ts': ts.toString(),
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        };
    },

    /**
     * Verify incoming webhook signature from Sumsub
     * CRITICAL for security - prevents spoofing of verification results
     */
    verifyWebhookSignature(payload: string, signature: string) {
        const secret = process.env.SUMSUB_WEBHOOK_SECRET || SUMSUB_SECRET_KEY;
        if (!secret || secret.length < 16) {
            console.error('[SumSub] Webhook secret not configured or insufficient entropy.');
            return false;
        }
        try {
            const calculated = crypto
                .createHmac('sha256', secret)
                .update(payload)
                .digest('hex');
                
            const hashCalculated = crypto.createHash('sha256').update(calculated).digest();
            const hashSignature = crypto.createHash('sha256').update(signature).digest();
            return crypto.timingSafeEqual(hashCalculated, hashSignature);
        } catch (err) {
            console.error('[SumSub] Webhook signature verification error:', err);
            return false;
        }
    }
};


