export interface ITavilySearchInitParams {
  baseUrl?: string;
  apiKey: string;
}

export interface ITavilySearchResult {
  title: string;
  url: string;
  content: string; // Text content from the search result
}

export class TavilySearch {
  baseUrl: string;
  apiKey: string;

  constructor(initParams: ITavilySearchInitParams) {
    this.baseUrl = initParams.baseUrl || "https://api.tavily.com";
    this.apiKey = initParams.apiKey;
  }

  async search(query: string): Promise<ITavilySearchResult[]> {
    const response = await fetch(`${this.baseUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query: query,
        max_results: 10, // Request 10 results, adjust as needed
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Tavily API Error:", response.status, errorBody);
      throw new Error(
        `Failed to search with Tavily API: ${response.statusText}`,
      );
    }

    const json = await response.json();

    // Map the response structure to ITavilySearchResult
    const formattedResults = json.results.map((result: any) => ({
      title: result.title || "No Title",
      url: result.url,
      content: result.content || "No content",
    }));

    return formattedResults;
  }
}
