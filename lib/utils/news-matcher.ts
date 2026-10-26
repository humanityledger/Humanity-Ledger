import { NewsItem } from '@/types/wallet'; // Ensure this type exists

export function matchNewsToMarket(marketQuestion: string, newsItems: NewsItem[]): string | undefined {
    if (!marketQuestion || !newsItems.length) return undefined;

    // 1. Normalization: Lowercase and remove special characters
    const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/gi, '');

    const cleanQuestion = normalize(marketQuestion);

    // 2. Find matches
    const match = newsItems.find(news => {
        const cleanHeadline = normalize(news.title);

        // A. Strong direct match
        if (cleanHeadline.includes(cleanQuestion) || cleanQuestion.includes(cleanHeadline)) {
            return true;
        }

        // B. Keyword matching (Simple heuristic)
        // Extract long keywords (>4 letters) from news title
        const keywords = cleanHeadline.split(' ').filter(word => word.length > 4);
        // If market question contains at least 2 keywords from the news
        const hits = keywords.filter(word => cleanQuestion.includes(word));

        return hits.length >= 2;
    });

    return match ? match.title : undefined;
}
