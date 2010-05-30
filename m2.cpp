#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>

int pipe_out[2];
int pipe_err[2];

void closePipes(){
	close(pipe_out[1]);
	close(pipe_err[1]);
	close(pipe_out[0]);
	close(pipe_err[0]);
}

int main(){

	
	char str[200];
	char proc1[100];
	char proc2[100];
	char proc3[100];
	char *proc = NULL;
	while(1){

		printf("> ");
		fgets(str,200,stdin);
		
		int str_len = strlen(str);

		if(str_len == 1)
			continue;
		
		str[str_len-1] = 0;
		
		int cur_proc = 1;
		int j = 0;
		for(int i = 0;i<str_len;i++){
			if(cur_proc==1) proc = proc1;
			if(cur_proc==2) proc = proc2;
			if(cur_proc==3) proc = proc3;
			 		
			switch(str[i]){
				
				case ' ':
					break;
				case '|':
					cur_proc++; proc[j] = 0;j = 0;
					break;	
				case 0:
					proc[j] = 0;
					break;
				default:
					proc[j++] = str[i];
					break;		
			}		
		}
		

		printf("Process 1: %s\nProcess 2: %s\nProcess 3: %s\n",proc1,proc2,proc3);

		if(pipe(pipe_out)){
			printf("Pipe error");
			continue;
		}
		if(pipe(pipe_err)){
			printf("Pipe error");
			close(pipe_out[0]);
			close(pipe_out[1]);
			continue;		
		}
	
		int code_fork1 = fork();
		if(code_fork1 < 0 ){
			perror("Error while forking");
			closePipes();
			continue;
		}
		if(code_fork1 == 0){
			if(dup2(pipe_out[1], STDOUT_FILENO) == -1){
				perror("Dup pipe_out error: process1");
				
			}
			if(dup2(pipe_err[1], STDERR_FILENO) == -1){
				perror("Dup pipe_err error: process1");
				
			}
			closePipes();			
			if(execlp(proc1,proc1,NULL)){
				perror("Invalid command process1\n");
						
			}
			
			exit(0);
			
		}
		
		int code_fork2 = fork();
		if(code_fork2 < 0) {
			perror("Error while forking");
			closePipes();
			continue;	
		}
		if(code_fork2 == 0){
			if(dup2(pipe_out[0], STDIN_FILENO) == -1){
				perror("Dup error: process2");
				
			}		
			closePipes();
			if(execlp(proc2, proc2, NULL)){
				perror("Invalid command process2\n");
				
			}
			
			exit(0);
			
		}

		int code_fork3 = fork();
		if(code_fork3 < 0) {
			perror("Error while forking");
			closePipes();			
			continue;
		}
		if(code_fork3 == 0){
			if(dup2(pipe_err[0], STDIN_FILENO) == -1){
				perror("Dup error ,process3");
				
			}

			closePipes();
					
			if(execlp(proc3, proc3, NULL)){
				perror("Invalid command process3\n");
				
			}	
			exit(0);
			
		}
		closePipes();

		int status;
		wait(&status);
		wait(&status);
		wait(&status);
	}
	
	
	return 0;

}
