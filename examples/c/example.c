#include <stdio.h>

int double_value(int value) {
    return value * 2;
}

int main(void) {
    printf("%d\n", double_value(21));
    return 0;
}
