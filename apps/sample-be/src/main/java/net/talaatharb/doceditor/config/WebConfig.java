package net.talaatharb.doceditor.config;

import net.talaatharb.doceditor.security.DemoTokenFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final String[] allowedOrigins;

    public WebConfig(@Value("${app.cors.allowed-origins}") String allowedOrigins) {
        this.allowedOrigins = allowedOrigins.split(",");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("Authorization", "Content-Type");
    }

    @Bean
    FilterRegistrationBean<DemoTokenFilter> demoTokenFilterRegistration(DemoTokenFilter filter) {
        FilterRegistrationBean<DemoTokenFilter> registration = new FilterRegistrationBean<>(filter);
        registration.addUrlPatterns("/api/*");
        registration.setOrder(1);
        return registration;
    }
}
