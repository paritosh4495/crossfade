package com.crossfade.backend.health;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class RestSidecarHealthClient implements SidecarHealthClient {

    private final RestClient restClient;

    public RestSidecarHealthClient(@Value("${sidecar.base-url}") String baseUrl) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
    }

    @Override
    public boolean isSidecarUp() {
        try {
            return restClient.get()
                    .uri("/health")
                    .retrieve()
                    .toBodilessEntity()
                    .getStatusCode()
                    .is2xxSuccessful();
        } catch (RestClientException e) {
            return false;
        }
    }
}
