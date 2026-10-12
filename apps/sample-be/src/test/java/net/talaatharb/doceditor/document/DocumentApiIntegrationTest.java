package net.talaatharb.doceditor.document;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.datasource.url=jdbc:h2:mem:doc-editor-test;DB_CLOSE_DELAY=-1",
                "spring.jpa.hibernate.ddl-auto=create-drop"
        })
class DocumentApiIntegrationTest {
    @LocalServerPort
    private int port;

    @Autowired
    private JsonMapper mapper;

    @Test
    void createsSavesAndRejectsStaleDocumentVersions() throws Exception {
        HttpResponse<String> unauthorized = request("GET", "/api/documents", null, null);
        assertThat(unauthorized.statusCode()).isEqualTo(401);

        HttpResponse<String> badLogin = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/token"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString("{\"username\":\"a\",\"password\":\"nope\"}"))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(badLogin.statusCode()).isEqualTo(401);

        HttpResponse<String> tokenResponse = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/token"))
                        .header("Origin", "http://127.0.0.1:5173")
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString("{\"username\":\"a\",\"password\":\"demo\"}"))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(tokenResponse.statusCode()).isEqualTo(200);
        JsonNode tokenBody = mapper.readTree(tokenResponse.body());
        String token = tokenBody.get("token").asString();

        HttpResponse<String> createdResponse = request(
                "POST", "/api/documents", Map.of("title", "Integration test"), token);
        assertThat(createdResponse.statusCode()).isEqualTo(201);
        JsonNode created = mapper.readTree(createdResponse.body());
        String id = created.get("id").asString();
        assertThat(created.get("version").asLong()).isEqualTo(1);

        Map<String, Object> meta = Map.of(
                "title", "Integration test",
                "pageSize", "A4",
                "orientation", "portrait",
                "margins", Map.of("top", 20, "right", 20, "bottom", 20, "left", 20),
                "schemaVersion", 1);
        Map<String, Object> save = Map.of(
                "content", Map.of("type", "doc", "content", new Object[0]),
                "meta", meta,
                "baseVersion", 1);
        HttpResponse<String> saved = request("PUT", "/api/documents/" + id, save, token);
        assertThat(saved.statusCode()).isEqualTo(200);
        assertThat(mapper.readTree(saved.body()).get("version").asLong()).isEqualTo(2);

        HttpResponse<String> conflict = request("PUT", "/api/documents/" + id, save, token);
        assertThat(conflict.statusCode()).isEqualTo(409);

        HttpResponse<String> restored = request(
                "POST", "/api/documents/" + id + "/versions/1/restore", null, token);
        assertThat(mapper.readTree(restored.body()).get("version").asLong()).isEqualTo(3);

        JsonNode versions = mapper.readTree(request("GET", "/api/documents/" + id + "/versions", null, token).body());
        assertThat(versions).hasSize(3);

        request("DELETE", "/api/documents/" + id, null, token);
    }

    private HttpResponse<String> request(String method, String path, Object body, String token) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token);
        HttpRequest.BodyPublisher publisher = body == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body));
        return HttpClient.newHttpClient().send(
                builder.method(method, publisher).build(),
                HttpResponse.BodyHandlers.ofString());
    }
}
