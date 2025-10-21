# Docker 数据持久化目录

此目录用于存储 Docker Compose 容器的持久化数据:

- `postgres/` - PostgreSQL 数据库数据
- `redis/` - Redis 持久化数据

## 注意事项

1. 此目录内容不会被提交到 Git 仓库
2. 重建 Docker Compose 容器时,数据不会丢失
3. 备份此目录即可备份所有数据库数据
4. 删除此目录将清空所有数据库数据

## 权限问题

如果遇到 PostgreSQL 权限问题,执行:
```bash
sudo chown -R 999:999 data/postgres
```

如果遇到 Redis 权限问题,执行:
```bash
sudo chown -R 999:999 data/redis
```
