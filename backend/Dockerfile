# =========================================================
# AquaWatch Pro — Spring Boot Backend Dockerfile for Render
# =========================================================

# Build Stage
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Runtime Stage
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

ENV PORT=8080
EXPOSE 8080

# Run Spring Boot application with dynamic port assignment for Render
CMD ["sh", "-c", "java -Dserver.port=${PORT} -jar app.jar"]
