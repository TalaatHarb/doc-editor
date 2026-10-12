package com.talaatharb.doceditor.auth;

import com.talaatharb.doceditor.security.DemoTokenFilter;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @PostMapping("/token")
    public TokenResponse issueToken() {
        return new TokenResponse(DemoTokenFilter.TOKEN);
    }

    public record TokenResponse(String token) {}
}
