package com.crossfade.backend.health;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {

    private final SidecarHealthClient sidecarHealthClient;

    public HealthController(SidecarHealthClient sidecarHealthClient) {
        this.sidecarHealthClient = sidecarHealthClient;
    }

    @GetMapping("/health")
    public ResponseEntity<HealthResponse> health() {
        boolean sidecarUp = sidecarHealthClient.isSidecarUp();
        HealthResponse body = new HealthResponse("up", sidecarUp ? "up" : "down");
        HttpStatus status = sidecarUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
        return ResponseEntity.status(status).body(body);
    }
}
