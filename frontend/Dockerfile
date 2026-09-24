# ─────────────────────────────────────────────────────────────────────────────
# Candylandia Store — frontend (React + Vite, servido por nginx)
#
# Dos etapas: Node solo existe para construir. Lo que se despliega es nginx
# con un puñado de archivos estáticos — ni node_modules ni Node en la imagen
# final, que pasa de ~400 MB a ~50 MB y deja fuera un montón de superficie
# que no hace falta en producción.
# ─────────────────────────────────────────────────────────────────────────────

# ── Etapa 1: construir ──────────────────────────────────────────────────────
FROM node:20-alpine AS constructor

WORKDIR /app

# package.json primero: mientras las dependencias no cambien, tocar el código
# no vuelve a bajar medio npm.
COPY package.json package-lock.json* ./

# `npm ci` si hay lockfile (reproducible, que es lo que uno quiere en un
# despliegue); `npm install` si todavía no lo hay.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

RUN npm run build

# ── Etapa 2: servir ─────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# La configuración por defecto de nginx escucha en el 80 y no sabe nada del
# SPA ni del backend; se va entera y se pone la nuestra.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/candylandia.conf

COPY --from=constructor /app/dist /usr/share/nginx/html

# 1515 y no 80: este contenedor nunca se asoma a internet por su cuenta, el
# nginx del host es quien recibe el tráfico y lo reenvía.
EXPOSE 1515

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:1515/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
