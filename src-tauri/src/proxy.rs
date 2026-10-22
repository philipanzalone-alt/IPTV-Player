use std::collections::HashMap;

/// Proxy HTTP GET request with custom headers (bypasses CORS)
pub async fn proxy_get(
    url: &str,
    user_agent: &str,
    extra_headers: Option<HashMap<String, String>>,
) -> Result<ProxyResponse, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let mut request = client.get(url).header("User-Agent", user_agent);

    if let Some(headers) = extra_headers {
        for (key, value) in headers {
            request = request.header(&key, &value);
        }
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Proxy request failed: {}", e))?;

    let status = response.status().as_u16();
    let headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| {
            (
                k.to_string(),
                v.to_str().unwrap_or("").to_string(),
            )
        })
        .collect();

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read proxy response: {}", e))?;

    Ok(ProxyResponse {
        status,
        headers,
        body,
    })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}
