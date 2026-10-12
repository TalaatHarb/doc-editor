package net.talaatharb.doceditor.auth;

import net.talaatharb.doceditor.security.DemoTokenFilter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Demo-only login: any non-blank username with the password "demo". Not real authentication. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @PostMapping("/token")
    public TokenResponse issueToken(@RequestBody LoginRequest request) {
        if (request.username() == null || request.username().isBlank() || !"demo".equals(request.password())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return new TokenResponse(DemoTokenFilter.TOKEN);
    }

    public record LoginRequest(String username, String password) {}

    public record TokenResponse(String token) {}
}
