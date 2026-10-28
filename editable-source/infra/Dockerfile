# Local/static research stage only. This image is NOT an approved production release.
FROM nginx:1.27-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/
EXPOSE 8080
