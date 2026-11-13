import { providerKey } from '@/lib/server/provider-keys';

export interface NewsArticle {
    id: string;
    title: string;
    link: string;
    description: string;
    content: string;
    pubDate: string;
    source: string;
    imageUrl: string | null;
    category: string[];
}

/**
 * PARALLEL IMPLEMENTATION FOR HIGH PERFORMANCE (50 ITEMS)
 */
export class NewsDataService {
    private static readonly BASE_URL = "https://newsdata.io/api/1/news";
    // Check all possible variable names the user might have set
    private static readonly API_KEY = process.env.NEWSDATA_API_KEY || providerKey('NEWS_API_KEY');

    // CONSTANTS
    private static readonly TARGET_LIMIT = 50;

    // [PHASE 6] FALLBACK DATA ERADICATED
    // All news must be sourced from live feeds.
    private static readonly FALLBACK_NEWS: NewsArticle[] = [];

    // ESTRATEGIAS DE PARALELISMO
    // To achieve 50 items quickly without slow sequential pagination,
    // we launch multiple related queries in parallel.
    private static readonly PARALLEL_STRATEGIES: Record<string, string[]> = {
        'trending': ['prediction markets', 'polymarket', 'betting odds', 'election forecast', 'crypto betting'],
        'crypto': ['polymarket crypto', 'us election odds', 'bitcoin prediction', 'ethereum betting', 'defi prediction'],
        'tech': ['ai prediction markets', 'futarchy', 'prediction dao', 'gnosis', 'augur'],
        'politics': ['election betting', 'trump odds', 'biden odds', 'political betting', 'swing state poll'],
        'economy': ['fed rate prediction', 'inflation betting', 'recession odds', 'market sentiment', 'macro prediction'],
        'sports': ['sports betting', 'betting odds', 'draftkings', 'fanduel', 'prediction market sports'],
        'culture': ['oscars betting', 'novelty bets', 'prediction challenges', 'social betting', 'speculative markets'],
        'world': ['geopolitical prediction', 'war betting markets', 'global risk forecast', 'event contracts', 'outcome attesting'],
    };

    static async fetchLatest(query: string = 'actualidad'): Promise<NewsArticle[]> {
        return this.fetchByCategory('Trending'); // Default fallback
    }

    static async fetchByCategory(categoryName: string): Promise<NewsArticle[]> {
        if (!this.API_KEY) {
            console.warn("[NewsDataService] Missing NEWSDATA_API_KEY. Returning empty set (0% Simulation).");
            return [];
        }

        const strategies = this.getStrategiesForCategory(categoryName);
        console.log(`[NewsService] Fetching parallel strategies for ${categoryName}:`, strategies);

        try {
            // EXECUTE PARALLEL REQUESTS
            // Usamos Promise.allSettled para "Graceful Degradation"
            // Si una falla, las otras siguen.
            const results = await Promise.allSettled(
                strategies.map(strategy => this.fetchRawStrategy(strategy))
            );

            // AGGREGATE RESULTS
            let allArticles: NewsArticle[] = [];

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    allArticles = [...allArticles, ...result.value];
                } else {
                    console.warn(`[NewsService] Strategy '${strategies[index]}' failed:`, result.reason);
                }
            });

            // Verify we have enough articles
            if (allArticles.length === 0) {
                console.warn("[NewsService] API returned 0 items. Maintaining 0% Simulation policy.");
                return [];
            }

            // Note: Deduplication happens in the Processor
            return allArticles;

        } catch (error) {
            console.error("[NewsService Critical API Failure]:", error);
            // No synthetic fallbacks allowed per Phase 6 requirements
            return [];
        }
    }

    private static getStrategiesForCategory(categoryName: string): string[] {
        const cat = categoryName.toLowerCase();
        // If a predefined strategy exists, use it
        if (this.PARALLEL_STRATEGIES[cat]) {
            return this.PARALLEL_STRATEGIES[cat];
        }

        // Default strategy: Basic variety
        return ['top', 'world', 'business', 'technology', 'sports'];
    }

    private static async fetchRawStrategy(identifier: string): Promise<NewsArticle[]> {
        // Determinamos si es 'category' o 'q' (search)
        // NewsData.io standard categories are limited.
        const validCategories = ['business', 'entertainment', 'environment', 'food', 'health', 'politics', 'science', 'sports', 'technology', 'top', 'tourism', 'world'];

        const params = new URLSearchParams({
            apikey: this.API_KEY || '',
            language: 'en', // English
            image: '1',     // Try to force image
            size: '10'      // Max per request (Free tier usually 10)
        });

        const cat = identifier.toLowerCase();
        if (cat === 'trending') {
            params.set('q', 'prediction markets OR polymarket OR bitcoin');
        } else if (cat === 'crypto') {
            params.set('q', 'crypto OR blockchain OR web3');
        } else if (cat === 'ai') {
            params.set('q', 'artificial analytics OR openai OR ai tech');
        } else if (cat === 'macro') {
            params.set('q', 'economy OR inflation OR fed rate');
        } else {
            // For other categories, check if it's a valid NewsData.io category
            // If not, treat it as a search query
            if (validCategories.includes(cat)) {
                params.set('category', cat);
            } else {
                params.set('q', identifier);
            }
        }

        try {
            const response = await fetch(`${this.BASE_URL}?${params.toString()}`, {
                next: { revalidate: 300 }, // 5 min cache
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();

            if (data.status !== "success") return [];

            return (data.results || []).map((article: any) => ({
                id: article.article_id || article.link, // Fallback ID
                title: article.title,
                link: article.link,
                description: article.description,
                content: article.content,
                pubDate: article.pubDate,
                source: article.source_id,
                imageUrl: article.image_url,
                category: article.category,
            }));

        } catch (e) {
            console.error(`[NewsService] Error fetching strategy '${identifier}':`, e);
            return [];
        }
    }
}

export const fetchNewsByCategory = NewsDataService.fetchByCategory.bind(NewsDataService);

