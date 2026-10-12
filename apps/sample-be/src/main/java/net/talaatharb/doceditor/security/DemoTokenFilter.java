package net.talaatharb.doceditor.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class DemoTokenFilter extends OncePerRequestFilter {
    public static final String TOKEN = "local-demo-token";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().equals("/api/auth/token")
                || request.getMethod().equals("OPTIONS");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (!("Bearer " + TOKEN).equals(authorization)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Valid bearer token required");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
