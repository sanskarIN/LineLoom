data class User(val name: String)

fun greet(user: User): String = "Hello, ${user.name}"
