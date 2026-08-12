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
ENV DEBIAN_FRONTEND=noninteractive

# Reintentos por si apt del builder de Railway falla por red/transitorio.
RUN set -eux; \
    for i in 1 2 3; do \
      apt-get update && \
      apt-get install -y --no-install-recommends fontconfig fonts-liberation fonts-dejavu-core && \
      break || sleep 5; \
    done; \
    rm -rf /var/lib/apt/lists/*; \
    fc-cache -f; \
    mkdir -p /data/st2 && chmod 777 /data/st2

COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "PortalClienchi.Web.dll"]
