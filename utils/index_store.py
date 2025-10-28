from redis import Redis
from env import get_redis_env
from typing import Generator


redis_client = Redis(**get_redis_env())


class IndexStore:
    def __init__(self, name: str):
        self.redis_client = redis_client
        self.name = name
        self.meta_key = f"is:{self.name}:m:"
        self.data_key = f"is:{self.name}:d:"

    def add_meta(self, meta: dict):
        self.redis_client.hset(self.meta_key, mapping=meta)

    def add_meta_item(self, key: str, value: str):
        self.redis_client.hset(self.meta_key, key, value)

    def add(self, chunk_index: int, content: str):
        self.redis_client.hset(self.data_key, chunk_index, content)

    def update(self, chunk_index: int, content: str):
        self.redis_client.hset(self.data_key, chunk_index, content)

    def delete(self, chunk_index: int):
        self.redis_client.hdel(self.data_key, chunk_index)

    def count(self):
        return self.redis_client.hlen(self.data_key)

    def get(self, chunk_index: int):
        return self.redis_client.hget(self.data_key, chunk_index)

    def get_all(self):
        return self.redis_client.hgetall(self.data_key)
