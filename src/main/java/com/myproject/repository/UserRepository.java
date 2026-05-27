package com.myproject.repository;

import com.myproject.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {
    // Custom query method to find a user by email
    Optional<User> findByEmail(String email);
}
