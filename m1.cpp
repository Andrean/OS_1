#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <sys/wait.h>
#include <string.h>

void sig_handler(int s){
	int pid = getpid();
	printf("Pid: %i , Gid: %i got a signal %i\n",pid, getpgid(pid),SIGTERM );
}

int main(){
	
	int pid = getpid();

	if(setpgid(0, pid) != 0) {
		perror("Cannot create group");
		exit(0);
	}

	struct sigaction sa;
	memset(&sa,0,sizeof(struct sigaction));
	sa.sa_handler = sig_handler;
	sigaction(SIGTERM,&sa,0);

	for(int i = 0;i<3;i++){
		int f = fork();
		if(f < 0){
			perror("Cannot fork process");
			exit(0);	
		}		
		if(f == 0){
			while(1) { 
				pause();
			}
		}
	}

	while(1){
		getc(stdin);
		kill(-pid, SIGTERM);
	}
	return 0;

}


