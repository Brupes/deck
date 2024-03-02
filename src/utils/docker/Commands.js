export const DOCKER_COMPOSE_STOP = "docker compose down";
export const DOCKER_COMPOSE_STOP_BK = "docker-compose stop";
export const DOCKER_COMPOSE_UP =
    `docker compose build --force-rm ; ${DOCKER_COMPOSE_STOP}; docker-compose up -d`;
export const DOCKER_COMPOSE_RESTART =
    "docker compose build ; ${DOCKER_COMPOSE_STOP} ; docker-compose up -d";
export const DOCKER_COMPOSE_DOWN =
    "docker compose down --rmi all -v --remove-orphans";
