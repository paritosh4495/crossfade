// Manual verification for issue #13: does a playlist created via YouTube Data API v3
// show up in YouTube Music? Run with: java scripts/VerifyYoutubeMusicWrite.java <videoId> [videoId...]
//
// Reads YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET from ../.env.
// Requires an extra redirect URI on the Google OAuth client: http://localhost:8080/login/oauth2/code/youtube

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class VerifyYoutubeMusicWrite {

    static final String REDIRECT_URI = "http://localhost:8080/login/oauth2/code/youtube";
    static final String SCOPE = "https://www.googleapis.com/auth/youtube";

    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            System.err.println("Usage: java VerifyYoutubeMusicWrite.java <videoId> [videoId...]");
            System.err.println("Grab videoIds from a music.youtube.com URL, e.g. https://music.youtube.com/watch?v=XXXXXXXXXXX");
            System.exit(1);
        }

        var env = loadEnv(Path.of(System.getProperty("user.dir"), ".env"));
        String clientId = require(env, "YOUTUBE_CLIENT_ID");
        String clientSecret = require(env, "YOUTUBE_CLIENT_SECRET");

        String code = getAuthorizationCode(clientId);
        String accessToken = exchangeCodeForToken(clientId, clientSecret, code);

        String playlistId = createPlaylist(accessToken);
        System.out.println("Created playlist: " + playlistId);

        for (String videoId : args) {
            addVideoToPlaylist(accessToken, playlistId, videoId);
            System.out.println("Added video: " + videoId);
        }

        System.out.println();
        System.out.println("Check it on YouTube Music: https://music.youtube.com/playlist?list=" + playlistId);
        System.out.println("Check it on YouTube:       https://www.youtube.com/playlist?list=" + playlistId);
        System.out.println();
        System.out.println("Quota spent: " + (50 + 50L * args.length) + " units (50 for playlists.insert, 50 per playlistItems.insert)");
    }

    static String getAuthorizationCode(String clientId) throws Exception {
        CompletableFuture<String> codeFuture = new CompletableFuture<>();
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
        server.createContext("/login/oauth2/code/youtube", exchange -> {
            String query = exchange.getRequestURI().getQuery();
            String code = paramValue(query, "code");
            String response = code != null
                ? "Got the code. You can close this tab."
                : "No code in callback. Check the console.";
            exchange.sendResponseHeaders(200, response.length());
            exchange.getResponseBody().write(response.getBytes(StandardCharsets.UTF_8));
            exchange.close();
            if (code != null) codeFuture.complete(code);
        });
        server.start();

        String authUrl = "https://accounts.google.com/o/oauth2/v2/auth"
            + "?client_id=" + urlEncode(clientId)
            + "&redirect_uri=" + urlEncode(REDIRECT_URI)
            + "&response_type=code"
            + "&scope=" + urlEncode(SCOPE)
            + "&access_type=offline"
            + "&prompt=consent";

        System.out.println("Open this URL, sign in, and grant access:");
        System.out.println(authUrl);
        try {
            java.awt.Desktop.getDesktop().browse(URI.create(authUrl));
        } catch (Exception e) {
            // Headless or no default browser; the printed URL above is enough.
        }

        String code = codeFuture.get();
        server.stop(0);
        return code;
    }

    static String exchangeCodeForToken(String clientId, String clientSecret, String code) throws Exception {
        String body = "code=" + urlEncode(code)
            + "&client_id=" + urlEncode(clientId)
            + "&client_secret=" + urlEncode(clientSecret)
            + "&redirect_uri=" + urlEncode(REDIRECT_URI)
            + "&grant_type=authorization_code";

        String response = post("https://oauth2.googleapis.com/token", body, null);
        String token = jsonStringValue(response, "access_token");
        if (token == null) {
            throw new RuntimeException("Token exchange failed: " + response);
        }
        return token;
    }

    static String createPlaylist(String accessToken) throws Exception {
        String body = """
            {"snippet":{"title":"Crossfade verify test","description":"Created by scripts/VerifyYoutubeMusicWrite.java for issue #13"},"status":{"privacyStatus":"private"}}
            """;
        String response = post("https://www.googleapis.com/youtube/v3/playlists?part=snippet,status", body, accessToken);
        String id = jsonStringValue(response, "id");
        if (id == null) {
            throw new RuntimeException("playlists.insert failed: " + response);
        }
        return id;
    }

    static void addVideoToPlaylist(String accessToken, String playlistId, String videoId) throws Exception {
        String body = """
            {"snippet":{"playlistId":"%s","resourceId":{"kind":"youtube#video","videoId":"%s"}}}
            """.formatted(playlistId, videoId);
        String response = post("https://www.googleapis.com/youtube/v3/playlistItems?part=snippet", body, accessToken);
        if (jsonStringValue(response, "id") == null) {
            throw new RuntimeException("playlistItems.insert failed for " + videoId + ": " + response);
        }
    }

    static String post(String url, String body, String bearerToken) throws Exception {
        var requestBuilder = HttpRequest.newBuilder(URI.create(url))
            .POST(HttpRequest.BodyPublishers.ofString(body));
        requestBuilder.header("Content-Type", bearerToken == null
            ? "application/x-www-form-urlencoded"
            : "application/json");
        if (bearerToken != null) {
            requestBuilder.header("Authorization", "Bearer " + bearerToken);
        }
        HttpResponse<String> response = HttpClient.newHttpClient()
            .send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
        return response.body();
    }

    static String jsonStringValue(String json, String key) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        return m.find() ? m.group(1) : null;
    }

    static String paramValue(String query, String key) {
        if (query == null) return null;
        for (String pair : query.split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2 && kv[0].equals(key)) {
                return java.net.URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    static String urlEncode(String s) {
        return java.net.URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    static java.util.Map<String, String> loadEnv(Path path) throws IOException {
        var map = new java.util.HashMap<String, String>();
        for (String line : Files.readAllLines(path)) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#") || !trimmed.contains("=")) continue;
            int i = trimmed.indexOf('=');
            map.put(trimmed.substring(0, i).trim(), trimmed.substring(i + 1).trim());
        }
        return map;
    }

    static String require(java.util.Map<String, String> env, String key) {
        String value = env.get(key);
        if (value == null || value.isEmpty()) {
            throw new RuntimeException("Missing " + key + " in .env");
        }
        return value;
    }
}
