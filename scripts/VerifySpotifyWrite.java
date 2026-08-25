// Manual verification: does Spotify's Web API actually let this app write a playlist
// for the owner's account, given the owner does not have Spotify Premium?
// Run with: java scripts/VerifySpotifyWrite.java <trackId> [trackId...]
//
// Reads SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET from ../.env.
// Requires a redirect URI on the Spotify app: http://127.0.0.1:8080/login/oauth2/code/spotify

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
import java.util.Base64;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class VerifySpotifyWrite {

    static final String REDIRECT_URI = "http://127.0.0.1:8080/login/oauth2/code/spotify";
    static final String SCOPE = "playlist-modify-private";

    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            System.err.println("Usage: java VerifySpotifyWrite.java <trackId> [trackId...]");
            System.err.println("Grab trackIds from a Spotify share link, e.g. open.spotify.com/track/XXXXXXXXXXXXXXXXXXXXXX");
            System.exit(1);
        }

        var env = loadEnv(Path.of(System.getProperty("user.dir"), ".env"));
        String clientId = require(env, "SPOTIFY_CLIENT_ID");
        String clientSecret = require(env, "SPOTIFY_CLIENT_SECRET");

        String code = getAuthorizationCode(clientId);
        String accessToken = exchangeCodeForToken(clientId, clientSecret, code);

        String playlistId = createPlaylist(accessToken);
        System.out.println("Created playlist: " + playlistId);

        addTracksToPlaylist(accessToken, playlistId, args);
        System.out.println("Added " + args.length + " track(s)");

        System.out.println();
        System.out.println("Check it: https://open.spotify.com/playlist/" + playlistId);
    }

    static String getAuthorizationCode(String clientId) throws Exception {
        CompletableFuture<String> codeFuture = new CompletableFuture<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 8080), 0);
        server.createContext("/login/oauth2/code/spotify", exchange -> {
            String query = exchange.getRequestURI().getQuery();
            String code = paramValue(query, "code");
            String error = paramValue(query, "error");
            String response = code != null
                ? "Got the code. You can close this tab."
                : "Spotify returned an error: " + error + ". Check the console.";
            exchange.sendResponseHeaders(200, response.length());
            exchange.getResponseBody().write(response.getBytes(StandardCharsets.UTF_8));
            exchange.close();
            if (code != null) {
                codeFuture.complete(code);
            } else {
                codeFuture.completeExceptionally(new RuntimeException("Spotify authorize error: " + error));
            }
        });
        server.start();

        String authUrl = "https://accounts.spotify.com/authorize"
            + "?client_id=" + urlEncode(clientId)
            + "&response_type=code"
            + "&redirect_uri=" + urlEncode(REDIRECT_URI)
            + "&scope=" + urlEncode(SCOPE);

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
        String body = "grant_type=authorization_code"
            + "&code=" + urlEncode(code)
            + "&redirect_uri=" + urlEncode(REDIRECT_URI);

        String basicAuth = Base64.getEncoder().encodeToString(
            (clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

        HttpRequest request = HttpRequest.newBuilder(URI.create("https://accounts.spotify.com/api/token"))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("Authorization", "Basic " + basicAuth)
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        String response = send(request);

        String token = jsonStringValue(response, "access_token");
        if (token == null) {
            throw new RuntimeException("Token exchange failed: " + response);
        }
        return token;
    }

    static String createPlaylist(String accessToken) throws Exception {
        String body = """
            {"name":"Crossfade verify test","description":"Created by scripts/VerifySpotifyWrite.java","public":false}
            """;
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.spotify.com/v1/me/playlists"))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + accessToken)
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        String response = send(request);
        String id = jsonStringValue(response, "id");
        if (id == null) {
            throw new RuntimeException("Create playlist failed: " + response);
        }
        return id;
    }

    static void addTracksToPlaylist(String accessToken, String playlistId, String[] trackIds) throws Exception {
        var uris = new StringBuilder();
        for (int i = 0; i < trackIds.length; i++) {
            if (i > 0) uris.append(",");
            uris.append("\"spotify:track:").append(trackIds[i]).append("\"");
        }
        String body = "{\"uris\":[" + uris + "]}";
        HttpRequest request = HttpRequest.newBuilder(
                URI.create("https://api.spotify.com/v1/playlists/" + playlistId + "/items"))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + accessToken)
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        String response = send(request);
        if (jsonStringValue(response, "snapshot_id") == null) {
            throw new RuntimeException("Add tracks failed: " + response);
        }
    }

    static String send(HttpRequest request) throws Exception {
        HttpResponse<String> response = HttpClient.newHttpClient()
            .send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            System.err.println("HTTP " + response.statusCode() + ": " + response.body());
        }
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
