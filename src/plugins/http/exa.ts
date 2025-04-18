export interface IExaSearchInitParams {
  baseUrl?: string;
  apiKey: string;
}

export interface IExaSearchResult {
  title: string;
  url: string;
  text: string; // Text content from the search result
}

export class ExaSearch {
  baseUrl: string;
  apiKey: string;

  constructor(initParams: IExaSearchInitParams) {
    // Default Exa API endpoint
    this.baseUrl = initParams.baseUrl || "https://api.exa.ai";
    this.apiKey = initParams.apiKey;
  }

  async search(query: string): Promise<IExaSearchResult[]> {
    const response = await fetch(`${this.baseUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey, // Exa uses x-api-key header
        Accept: "application/json", // Ensure we get JSON back
      },
      // Request body structure based on the curl example
      body: JSON.stringify({
        query: query,
        contents: {
          text: { maxCharacters: 1000 }, // Request text snippets
        },
        numResults: 10, // Request 10 results, adjust as needed
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Exa API Error:", response.status, errorBody);
      throw new Error(`Failed to search with Exa API: ${response.statusText}`);
    }

    const json = await response.json();
    // Map the response structure to IExaSearchResult
    // Adjust based on actual Exa response format if different
    return json.results.map((result: any) => ({
      title: result.title || "No Title", // Provide default if title is missing
      url: result.url,
      text: result.text || "No text content", // Extract text from contents if available
    }));
  }
}
