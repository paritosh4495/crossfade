package com.crossfade.backend.health;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HealthController.class)
class HealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SidecarHealthClient sidecarHealthClient;

    @Test
    void reportsBothServicesUpWhenSidecarIsReachable() throws Exception {
        when(sidecarHealthClient.isSidecarUp()).thenReturn(true);

        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().json("{\"backend\":\"up\",\"sidecar\":\"up\"}"));
    }

    @Test
    void reportsSidecarDownWithoutFailingTheRequest() throws Exception {
        when(sidecarHealthClient.isSidecarUp()).thenReturn(false);

        mockMvc.perform(get("/api/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().json("{\"backend\":\"up\",\"sidecar\":\"down\"}"));
    }
}
