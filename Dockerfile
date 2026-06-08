FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY src/PortalClienchi.Core/ PortalClienchi.Core/
COPY src/PortalClienchi.Web/ PortalClienchi.Web/

RUN dotnet restore PortalClienchi.Web/PortalClienchi.Web.csproj
RUN dotnet publish PortalClienchi.Web/PortalClienchi.Web.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ST2_DATA_DIR=/data/st2

RUN mkdir -p /data/st2
VOLUME ["/data/st2"]

COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "PortalClienchi.Web.dll"]
