FROM mcr.microsoft.com/dotnet/sdk:9.0-bookworm-slim AS build
WORKDIR /src

COPY src/PortalClienchi.Core/ PortalClienchi.Core/
COPY src/PortalClienchi.Web/ PortalClienchi.Web/

RUN dotnet restore PortalClienchi.Web/PortalClienchi.Web.csproj \
 && dotnet publish PortalClienchi.Web/PortalClienchi.Web.csproj -c Release -o /app/publish /p:UseAppHost=false --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0-bookworm-slim AS final
WORKDIR /app

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ST2_DATA_DIR=/data/st2
ENV TMPDIR=/data/st2/tmp
ENV TMP=/data/st2/tmp
ENV TEMP=/data/st2/tmp
ENV DEBIAN_FRONTEND=noninteractive

# Reintentos por si apt del builder de Railway falla por red/transitorio.
RUN set -eux; \
    for i in 1 2 3 4 5; do \
      apt-get -o Acquire::Retries=5 update && \
      apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
        fontconfig fonts-liberation fonts-dejavu-core && \
      break; \
      echo "apt attempt $i failed; retrying..."; \
      sleep $((i * 8)); \
      apt-get clean || true; \
      rm -rf /var/lib/apt/lists/* || true; \
    done; \
    if command -v fc-cache >/dev/null; then \
      rm -rf /var/lib/apt/lists/*; \
      fc-cache -f; \
    else \
      echo "WARN: fontconfig missing after apt retries; continuing without extra fonts"; \
    fi; \
    mkdir -p /data/st2/tmp && chmod 777 /data/st2 /data/st2/tmp

COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "PortalClienchi.Web.dll"]
