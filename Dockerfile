FROM postgres:16

ADD "https://github.com/pksunkara/pgx_ulid/releases/download/v0.1.5/pgx_ulid-v0.1.5-pg16-amd64-linux-gnu.deb" \
    "/tmp/pgx_ulid.deb"

RUN dpkg -i /tmp/pgx_ulid.deb
RUN rm /tmp/pgx_ulid.deb

EXPOSE 5432

CMD ["postgres"]
